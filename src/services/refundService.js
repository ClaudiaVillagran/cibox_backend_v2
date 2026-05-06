import mongoose from "mongoose";
import { Refund } from "../models/Refund.js";
import { logger } from "../utils/logger.js";
import { withTransaction } from "../utils/transactions.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/errors.js";
import { ORDER_STATUS, PAID_STATUSES } from "../utils/constants.js";
import { env } from "../config/env.js";

const REFUND_WINDOW_DAYS = 7;

const getOrderModel = () => {
  if (!mongoose.models.Order) {
    throw new Error("Order model not registered");
  }
  return mongoose.models.Order;
};

const getProductModel = () => mongoose.models.Product || null;

const isWithinRefundWindow = (paidAt) => {
  if (!paidAt) return false;
  const ms = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(paidAt).getTime() <= ms;
};

const assertOrderOwnership = (order, identity) => {
  const { userId, guestId } = identity || {};
  if (userId && String(order.user_id) === String(userId)) return true;
  if (guestId && order.guest_id && String(order.guest_id) === String(guestId)) return true;
  throw new ForbiddenError("No tienes permiso sobre esta orden");
};

export const requestRefund = async ({
  orderId,
  identity,
  reason,
  description = "",
  items = [],
  type,
}) => {
  const Order = getOrderModel();
  const order = await Order.findById(orderId).lean();
  if (!order) throw new NotFoundError("Orden no encontrada");

  if (identity) assertOrderOwnership(order, identity);

  if (!PAID_STATUSES.includes(order.status)) {
    throw new ConflictError("La orden no es elegible para reembolso");
  }

  const paidAt = order.paid_at || order.payment?.paid_at || order.updated_at;
  if (!isWithinRefundWindow(paidAt)) {
    throw new ConflictError(
      `Ventana de reembolso vencida (${REFUND_WINDOW_DAYS} días)`
    );
  }

  let amount = 0;
  if (type === "full") {
    amount = Number(order.total || 0);
  } else {
    if (!items.length) throw new BadRequestError("Items requeridos para refund parcial");
    amount = items.reduce((acc, it) => acc + Number(it.amount || 0), 0);
    if (amount <= 0) throw new BadRequestError("Monto a reembolsar inválido");
    if (amount > Number(order.total || 0)) {
      throw new BadRequestError("Monto excede el total de la orden");
    }
  }

  const refund = await Refund.create({
    order_id: order._id,
    user_id: order.user_id || null,
    guest_id: order.guest_id || null,
    vendor_id: null,
    amount,
    reason,
    description,
    items,
    type,
    status: "pending",
    created_by: identity?.userId ? String(identity.userId) : "guest",
  });

  logger.info(
    { refund_id: String(refund._id), order_id: String(order._id), type, amount },
    "refund.requested"
  );

  return refund.toObject();
};

export const webpayRefund = async (token, amount) => {
  if (!token) {
    return { ok: false, response: { error: "missing_token" } };
  }
  try {
    const sdk = await import("transbank-sdk");
    const { WebpayPlus, Options, IntegrationCommerceCodes, IntegrationApiKeys, Environment } =
      sdk;

    const isProd = env.WEBPAY_ENV === "production";
    const commerceCode = isProd
      ? env.WEBPAY_COMMERCE_CODE
      : IntegrationCommerceCodes.WEBPAY_PLUS;
    const apiKey = isProd ? env.WEBPAY_API_KEY : IntegrationApiKeys.WEBPAY;
    const environment = isProd ? Environment.Production : Environment.Integration;

    const tx = new WebpayPlus.Transaction(new Options(commerceCode, apiKey, environment));
    const response = await tx.refund(token, amount);
    return { ok: true, response };
  } catch (err) {
    logger.error({ err: { message: err.message } }, "webpayRefund.failed");
    return { ok: false, response: { error: err.message } };
  }
};

export const approveRefund = async ({ refundId, adminId }) => {
  const Order = getOrderModel();
  const Product = getProductModel();

  return withTransaction(async (session) => {
    const refund = await Refund.findById(refundId).session(session);
    if (!refund) throw new NotFoundError("Refund no encontrado");
    if (refund.status !== "pending") {
      // Idempotencia: si ya está procesado, retornar
      if (refund.status === "processed") return refund.toObject();
      throw new ConflictError(`Refund en estado ${refund.status}`);
    }

    const order = await Order.findById(refund.order_id).session(session);
    if (!order) throw new NotFoundError("Orden no encontrada");

    const token = order.payment?.token || order.payment?.transbank_token || null;

    const { ok, response } = await webpayRefund(token, refund.amount);

    if (!ok) {
      refund.status = "failed";
      refund.transbank_response = response;
      refund.processed_at = new Date();
      refund.processed_by = adminId || null;
      await refund.save({ session });

      logger.warn(
        { refund_id: String(refund._id), response },
        "refund.failed"
      );
      return refund.toObject();
    }

    refund.status = "processed";
    refund.transbank_response = response;
    refund.processed_at = new Date();
    refund.processed_by = adminId || null;
    await refund.save({ session });

    // Reverte stock
    if (Product && refund.items?.length) {
      for (const it of refund.items) {
        await Product.updateOne(
          { _id: it.product_id },
          { $inc: { stock: Number(it.quantity || 0) } },
          { session }
        );
      }
    } else if (Product && refund.type === "full" && Array.isArray(order.items)) {
      for (const it of order.items) {
        if (!it.product_id) continue;
        await Product.updateOne(
          { _id: it.product_id },
          { $inc: { stock: Number(it.quantity || 0) } },
          { session }
        );
      }
    }

    if (refund.type === "full") {
      order.status = ORDER_STATUS.REFUNDED;
      if (order.payment) order.payment.status = "refunded";
      await order.save({ session });
    } else {
      order.partial_refunded_amount =
        Number(order.partial_refunded_amount || 0) + Number(refund.amount);
      await order.save({ session });
    }

    logger.info(
      {
        refund_id: String(refund._id),
        order_id: String(order._id),
        amount: refund.amount,
        admin_id: String(adminId || ""),
      },
      "refund.processed"
    );

    return refund.toObject();
  });
};

export const rejectRefund = async ({ refundId, adminId, reason }) => {
  const refund = await Refund.findById(refundId);
  if (!refund) throw new NotFoundError("Refund no encontrado");
  if (refund.status !== "pending") {
    throw new ConflictError(`Refund en estado ${refund.status}`);
  }
  refund.status = "rejected";
  refund.processed_at = new Date();
  refund.processed_by = adminId || null;
  refund.transbank_response = { rejection_reason: reason };
  await refund.save();

  logger.info(
    { refund_id: String(refund._id), admin_id: String(adminId || "") },
    "refund.rejected"
  );
  return refund.toObject();
};

export const listRefunds = async ({
  status,
  userId,
  adminView = false,
  page = 1,
  limit = 20,
}) => {
  const filter = {};
  if (status) filter.status = status;
  if (!adminView && userId) filter.user_id = userId;
  if (adminView && userId) filter.user_id = userId;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Refund.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Refund.countDocuments(filter),
  ]);

  return { items, total, page, limit };
};

export const getRefundById = async (refundId) => {
  const refund = await Refund.findById(refundId).lean();
  if (!refund) throw new NotFoundError("Refund no encontrado");
  return refund;
};
