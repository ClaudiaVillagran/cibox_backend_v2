import Order from "../models/Order.js";

import { asyncHandler } from "../middlewares/errorHandler.js";
import { getRequestIdentity } from "../utils/ownership.js";
import {
  BadRequestError,
  ForbiddenError,
} from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { sendEmail } from "../services/emailService.js";
import { VALID_TRANSITIONS } from "../utils/constants.js";

import {
  createOrderFromCart as svcCreateFromCart,
  createOrderFromCustomBox as svcCreateFromCustomBox,
  cancelOrder as svcCancelOrder,
  findOrderForOwner,
  verifyGuestOrderAccess,
} from "../services/orderService.js";
import {
  retryPayment as svcRetryPayment,
} from "../services/paymentService.js";

const sanitizeOrder = (order) => {
  if (!order) return null;
  if (typeof order.toJSON === "function") return order.toJSON();
  const clone = { ...order };
  delete clone.guest_token_hash;
  return clone;
};

const sendOrderCreatedEmail = async ({ order }) => {
  const email = order.customer?.email;
  if (!email) return;
  try {
    await sendEmail({
      to: email,
      subject: `Orden creada #${String(order._id).slice(-8)}`,
      text: `Hola ${order.customer.fullName || ""}, tu orden ha sido creada por un total de $${order.total}. Cuando completes el pago te avisaremos.`,
      html: `<p>Hola ${order.customer.fullName || ""},</p><p>Tu orden ha sido creada por un total de <strong>$${order.total}</strong>. Cuando completes el pago te avisaremos.</p>`,
    });
  } catch (err) {
    logger.warn({ err: err.message }, "no se pudo enviar email de orden creada");
  }
};

/* ------------------------------ handlers --------------------------------- */

export const createFromCart = asyncHandler(async (req, res) => {
  const identity = getRequestIdentity(req);
  if (!identity.userId && !identity.guestId) {
    throw new BadRequestError("Identidad requerida (login o x-guest-id)");
  }

  const { customer, shipping, payment, notes, couponCode } = req.body;

  const result = await svcCreateFromCart({
    identity,
    user: req.user,
    customer,
    shipping,
    payment,
    notes,
    couponCode,
  });

  await sendOrderCreatedEmail({ order: result.order });

  return res.status(201).json({
    success: true,
    data: {
      order: sanitizeOrder(result.order),
      guest_token: result.guestToken || undefined,
      coupon: result.couponInfo || undefined,
    },
  });
});

export const createFromCustomBox = asyncHandler(async (req, res) => {
  const identity = getRequestIdentity(req);
  if (!identity.userId && !identity.guestId) {
    throw new BadRequestError("Identidad requerida (login o x-guest-id)");
  }

  const { items, customer, shipping, payment, notes, couponCode } = req.body;

  const result = await svcCreateFromCustomBox({
    identity,
    user: req.user,
    items,
    customer,
    shipping,
    payment,
    notes,
    couponCode,
  });

  await sendOrderCreatedEmail({ order: result.order });

  return res.status(201).json({
    success: true,
    data: {
      order: sanitizeOrder(result.order),
      guest_token: result.guestToken || undefined,
      coupon: result.couponInfo || undefined,
    },
  });
});

export const getMyOrders = asyncHandler(async (req, res) => {
  if (!req.user?.id) throw new ForbiddenError("Login requerido");

  const orders = await Order.find({ user_id: req.user.id })
    .sort({ created_at: -1 })
    .limit(100);

  return res.status(200).json({
    success: true,
    data: orders.map(sanitizeOrder),
  });
});

export const getOrderById = asyncHandler(async (req, res) => {
  // Admin puede ver cualquier orden sin verificar ownership
  if (req.user?.role === "admin") {
    const order = await Order.findById(req.params.id).select("-guest_token_hash").lean();
    if (!order) throw new BadRequestError("Orden no encontrada");
    return res.status(200).json({ success: true, data: order });
  }

  const identity = getRequestIdentity(req);
  identity.guestToken = req.query?.token || req.body?.guestToken || null;

  const order = await findOrderForOwner({
    orderId: req.params.id,
    identity,
    includeGuestToken: true,
  });

  return res.status(200).json({ success: true, data: sanitizeOrder(order) });
});

export const getGuestOrderById = asyncHandler(async (req, res) => {
  const order = await verifyGuestOrderAccess({
    orderId: req.params.id,
    token: req.query.token,
  });
  return res.status(200).json({ success: true, data: sanitizeOrder(order) });
});

export const cancelMyOrder = asyncHandler(async (req, res) => {
  const identity = getRequestIdentity(req);
  identity.guestToken = req.body?.guestToken || null;

  if (!identity.userId && !identity.guestId && !identity.guestToken) {
    throw new BadRequestError("Identidad requerida para cancelar la orden");
  }

  const order = await svcCancelOrder({
    orderId: req.params.id,
    reason: req.body?.reason,
    byAdmin: false,
    identity,
  });

  return res.status(200).json({ success: true, data: sanitizeOrder(order) });
});

export const retryPayment = asyncHandler(async (req, res) => {
  const identity = getRequestIdentity(req);
  identity.guestToken = req.body?.guestToken || null;

  const order = await findOrderForOwner({
    orderId: req.params.id,
    identity,
    includeGuestToken: true,
  });

  const result = await svcRetryPayment({
    order,
    platform: req.body?.platform,
  });

  return res.status(200).json({
    success: true,
    data: result,
  });
});

/* ------------------------------- admin ----------------------------------- */

export const adminListOrders = asyncHandler(async (req, res) => {
  if (req.user?.role !== "admin") throw new ForbiddenError("Solo admin");

  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(50, parseInt(req.query.limit) || 20);
  const status = req.query.status || null;
  const skip   = (page - 1) * limit;

  const filter = {};
  if (status) filter.status = status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .select("-guest_token_hash")
      .lean(),
    Order.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    data: {
      orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

export const adminCancelOrder = asyncHandler(async (req, res) => {
  if (req.user?.role !== "admin") throw new ForbiddenError("Solo admin");

  const order = await svcCancelOrder({
    orderId: req.params.id,
    reason: req.body?.reason,
    byAdmin: true,
  });

  return res.status(200).json({ success: true, data: sanitizeOrder(order) });
});

export const adminUpdateOrderStatus = asyncHandler(async (req, res) => {
  if (req.user?.role !== "admin") throw new ForbiddenError("Solo admin");

  const { id } = req.params;
  const { status, tracking_number, note } = req.body;

  const order = await Order.findById(id);
  if (!order) throw new BadRequestError("Orden no encontrada");

  const validNext = VALID_TRANSITIONS[order.status] || [];
  if (!validNext.includes(status)) {
    throw new BadRequestError(
      `Transición inválida: ${order.status} → ${status}. Permitidos: ${validNext.join(", ") || "ninguno"}`
    );
  }

  order.status = status;

  if (tracking_number) {
    order.shipping.tracking_number = tracking_number;
  }

  if (status === "cancelled") {
    order.cancelled_at = new Date();
    order.cancellation_reason = note || "Cancelado por admin";
  }

  // Registrar en historial de estados
  if (!Array.isArray(order.status_history)) order.status_history = [];
  order.status_history.push({ status, changed_at: new Date(), note: note || null });
  order.markModified("status_history");

  await order.save();

  // Email automático al cliente según el nuevo estado
  const email = order.customer?.email;
  if (email) {
    try {
      const messages = {
        paid:      { subject: "Pago confirmado", body: "Tu pago fue confirmado. Estamos preparando tu pedido." },
        preparing: { subject: "Preparando tu pedido", body: "Estamos preparando tu pedido. Pronto saldrá a despacho." },
        shipped: {
          subject: "Tu pedido está en camino 🚚",
          body: `Tu pedido está en camino.${tracking_number ? ` Número de seguimiento: <strong>${tracking_number}</strong>` : ""}`,
        },
        delivered: { subject: "Pedido entregado ✅", body: "Tu pedido fue entregado. ¡Gracias por comprar en CIBOX!" },
        cancelled: { subject: "Orden cancelada", body: `Tu orden fue cancelada.${note ? ` Motivo: ${note}` : ""}` },
      };

      const msg = messages[status];
      if (msg) {
        await sendEmail({
          to: email,
          subject: `${msg.subject} — Orden #${String(order._id).slice(-6).toUpperCase()}`,
          text: msg.body.replace(/<[^>]+>/g, ""),
          html: `<p>Hola ${order.customer.fullName || ""},</p><p>${msg.body}</p><p>Orden #${String(order._id).slice(-6).toUpperCase()}</p>`,
        });
      }
    } catch (err) {
      logger.warn({ err: err.message }, "no se pudo enviar email de cambio de estado");
    }
  }

  return res.status(200).json({ success: true, data: sanitizeOrder(order) });
});
