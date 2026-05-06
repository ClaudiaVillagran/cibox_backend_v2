import mongoose from "mongoose";
import { asyncHandler } from "../middlewares/errorHandler.js";
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import {
  ORDER_STATUS,
  PAID_STATUSES,
  VALID_TRANSITIONS,
  ROLES,
} from "../utils/constants.js";

import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Vendor from "../models/Vendor.js";
import { User } from "../models/User.js";

// Helpers ----------------------------------------------------------------

const buildDateMatch = (from, to) => {
  if (!from && !to) return null;
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return range;
};

const tryImport = async (path) => {
  try {
    return (await import(path)).default;
  } catch {
    return null;
  }
};

const safeCreateNotification = async (payload) => {
  if (!payload?.userId) return;
  const notif = await tryImport("../utils/notification.js");
  if (notif?.createNotification) {
    try {
      await notif.createNotification(payload);
    } catch (err) {
      logger.warn({ err: err.message }, "createNotification failed");
    }
  }
};

// Sales summary (paid only) ---------------------------------------------

export const getSalesSummary = asyncHandler(async (req, res) => {
  const { from, to, vendor_id, group_by } = req.query;

  const match = { status: { $in: PAID_STATUSES } };
  const dateMatch = buildDateMatch(from, to);
  if (dateMatch) match.created_at = dateMatch;
  if (vendor_id) match["items.vendor.id"] = vendor_id;

  const dateFormat = group_by === "month" ? "%Y-%m" : "%Y-%m-%d";

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: "$created_at" } },
        total_orders: { $sum: 1 },
        total_sales: { $sum: "$total" },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        period: "$_id",
        total_orders: 1,
        total_sales: 1,
        average_ticket: {
          $cond: [
            { $gt: ["$total_orders", 0] },
            { $divide: ["$total_sales", "$total_orders"] },
            0,
          ],
        },
      },
    },
  ];

  const series = await Order.aggregate(pipeline);
  const totals = series.reduce(
    (acc, p) => {
      acc.total_orders += p.total_orders;
      acc.total_sales += p.total_sales;
      return acc;
    },
    { total_orders: 0, total_sales: 0 }
  );
  totals.average_ticket =
    totals.total_orders > 0 ? Math.round(totals.total_sales / totals.total_orders) : 0;

  res.json({ success: true, data: { totals, series } });
});

export const getTopSellingProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const match = { status: { $in: PAID_STATUSES } };
  const dateMatch = buildDateMatch(req.query.from, req.query.to);
  if (dateMatch) match.created_at = dateMatch;

  const top = await Order.aggregate([
    { $match: match },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product_id",
        name: { $first: "$items.name" },
        total_quantity: { $sum: "$items.quantity" },
        total_revenue: { $sum: "$items.subtotal" },
      },
    },
    { $sort: { total_quantity: -1 } },
    { $limit: limit },
  ]);

  res.json({ success: true, data: top });
});

export const getDashboardMetrics = asyncHandler(async (req, res) => {
  const [
    paidOrdersAgg,
    totalOrders,
    activeUsers,
    activeProducts,
    totalVendors,
    pendingVendors,
  ] = await Promise.all([
    Order.aggregate([
      { $match: { status: { $in: PAID_STATUSES } } },
      { $group: { _id: null, total_sales: { $sum: "$total" }, count: { $sum: 1 } } },
    ]),
    Order.countDocuments({ status: { $in: PAID_STATUSES } }),
    User.countDocuments({ is_active: true }),
    Product.countDocuments({ is_active: true }),
    Vendor.countDocuments({ is_active: true }),
    Vendor.countDocuments({ is_verified: false, is_active: true }),
  ]);

  const sales = paidOrdersAgg[0] || { total_sales: 0, count: 0 };

  res.json({
    success: true,
    data: {
      total_sales: sales.total_sales,
      paid_orders: totalOrders,
      active_users: activeUsers,
      active_products: activeProducts,
      total_vendors: totalVendors,
      pending_vendors: pendingVendors,
    },
  });
});

// Orders -----------------------------------------------------------------

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { newStatus, reason } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new NotFoundError("Orden no encontrada");

  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new ConflictError(
      `Transición inválida: ${order.status} → ${newStatus}`
    );
  }

  if (newStatus === ORDER_STATUS.CANCELLED) {
    const orderService = await tryImport("../services/orderService.js");
    if (orderService?.cancelOrder) {
      await orderService.cancelOrder(order._id, { reason, by: req.user.id });
      const refreshed = await Order.findById(order._id).lean();
      return res.json({ success: true, data: refreshed, message: "Orden cancelada" });
    }
    // Fallback si no hay servicio: actualizar estado simple
    order.status = newStatus;
    await order.save();
  } else {
    order.status = newStatus;
    await order.save();
  }

  // Skip si guest (user_id null)
  if (order.user_id) {
    await safeCreateNotification({
      userId: order.user_id,
      type: "order_status_changed",
      title: "Actualización de pedido",
      message: `Tu pedido ${order._id} cambió a estado: ${newStatus}.`,
      data: { order_id: order._id, status: newStatus },
    });
  }

  logger.info(
    { order_id: String(order._id), from: order.status, to: newStatus, by: req.user.id },
    "order status updated"
  );
  res.json({ success: true, data: order, message: "Estado actualizado" });
});

export const listOrders = asyncHandler(async (req, res) => {
  const { page, limit, status, vendor_id, user_id, from, to } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (user_id) filters.user_id = user_id;
  if (vendor_id) filters["items.vendor.id"] = vendor_id;
  const dateMatch = buildDateMatch(from, to);
  if (dateMatch) filters.created_at = dateMatch;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Order.find(filters).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filters),
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    },
  });
});

// Users ------------------------------------------------------------------

export const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true }
  ).lean();
  if (!user) throw new NotFoundError("Usuario no encontrado");
  logger.info({ user_id: String(user._id), role, by: req.user.id }, "user role updated");
  res.json({ success: true, data: user, message: "Rol actualizado" });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, search, role, is_active } = req.query;
  const filters = {};
  if (role) filters.role = role;
  if (is_active !== undefined) filters.is_active = is_active;
  if (search) {
    const re = { $regex: String(search).trim(), $options: "i" };
    filters.$or = [{ name: re }, { email: re }];
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    User.find(filters)
      .select("-password_hash -refresh_token_hashes")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filters),
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    },
  });
});

export const toggleUserActive = asyncHandler(async (req, res) => {
  const { is_active } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { is_active },
    { new: true, runValidators: true }
  ).lean();
  if (!user) throw new NotFoundError("Usuario no encontrado");
  logger.info({ user_id: String(user._id), is_active }, "user active toggled");
  res.json({ success: true, data: user });
});

// CSV export -------------------------------------------------------------

const csvEscape = (val) => {
  if (val === null || val === undefined) return "";
  const s = String(val).replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) return `"${s}"`;
  return s;
};

export const exportOrdersCSV = asyncHandler(async (req, res) => {
  const { from, to, status } = req.query;
  const filters = {};
  if (status) filters.status = status;
  const dateMatch = buildDateMatch(from, to);
  if (dateMatch) filters.created_at = dateMatch;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`
  );

  const headers = [
    "order_id",
    "created_at",
    "status",
    "total",
    "user_id",
    "guest_id",
    "customer_email",
    "customer_name",
    "payment_status",
    "items_count",
    "shipping_region",
    "shipping_city",
  ];
  res.write(headers.join(",") + "\n");

  const cursor = Order.find(filters).sort({ created_at: -1 }).lean().cursor();
  for await (const o of cursor) {
    const row = [
      o._id,
      o.created_at?.toISOString?.() || "",
      o.status,
      o.total,
      o.user_id || "",
      o.guest_id || "",
      o.customer?.email || "",
      o.customer?.fullName || "",
      o.payment?.status || "",
      o.items?.length || 0,
      o.shipping?.region || "",
      o.shipping?.city || "",
    ].map(csvEscape);
    res.write(row.join(",") + "\n");
  }
  res.end();
});
