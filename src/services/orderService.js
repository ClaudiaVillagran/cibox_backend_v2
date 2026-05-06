import crypto from "node:crypto";

import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";

import {
  ORDER_STATUS,
  PAID_STATUSES,
  PAYMENT_STATUS,
  VALID_TRANSITIONS,
} from "../utils/constants.js";
import { withTransaction } from "../utils/transactions.js";
import { logger } from "../utils/logger.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/errors.js";
import { formatRut, isValidRut } from "../utils/rut.js";

import { calculateItemPricing } from "./pricingService.js";
import {
  decrementStockAtomic,
  restoreStock,
  checkStockAvailability,
} from "./stockService.js";
import {
  validateCouponForUser,
  calculateCouponDiscount,
  applyCouponToOrder,
  revertCouponUsage,
  findCouponByCode,
  findFirstPurchaseAutoCoupon,
} from "./couponService.js";
import { quoteShippingForOrder } from "./shippingService.js";

/* ------------------------------ helpers ---------------------------------- */

const normalizeEmail = (e) =>
  String(e || "")
    .trim()
    .toLowerCase();

const normalizePhoneCL = (phone = "") => {
  let v = String(phone || "").replace(/[^\d+]/g, "");
  if (v.startsWith("56")) v = `+${v}`;
  if (!v.startsWith("+56") && v.length === 9 && v.startsWith("9"))
    v = `+56${v}`;
  return v;
};

const isValidEmailFormat = (e) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(e));

const isValidPhoneCL = (p) => /^\+569\d{8}$/.test(normalizePhoneCL(p));

const validateCustomerAndShipping = ({ customer, shipping }) => {
  const errors = {};
  if (!String(customer?.fullName || "").trim())
    errors.fullName = "Nombre requerido";
  if (!isValidEmailFormat(customer?.email)) errors.email = "Email inválido";
  if (!isValidPhoneCL(customer?.phone)) errors.phone = "Teléfono inválido";
  if (!isValidRut(customer?.rut)) errors.rut = "RUT inválido";
  if (!String(shipping?.region || "").trim())
    errors.region = "Región requerida";
  if (!String(shipping?.city || "").trim()) errors.city = "Comuna requerida";
  if (String(shipping?.address || "").trim().length < 5)
    errors.address = "Dirección inválida";
  return errors;
};

const buildCustomer = (raw = {}) => ({
  fullName: String(raw.fullName || "").trim(),
  email: normalizeEmail(raw.email),
  phone: normalizePhoneCL(raw.phone),
  rut: formatRut(raw.rut || ""),
});

const buildShipping = (raw = {}) => ({
  region: String(raw.region || "").trim(),
  city: String(raw.city || "").trim(),
  address: String(raw.address || "").trim(),
  addressLine2: String(raw.addressLine2 || "").trim() || null,
  reference: String(raw.reference || "").trim() || null,
});

const issueGuestToken = () => crypto.randomBytes(32).toString("hex");
const hashGuestToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

const verifyGuestToken = (token, hash) => {
  if (!token || !hash) return false;
  const computed = hashGuestToken(token);
  const a = Buffer.from(computed);
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const isOrderOwner = ({ order, userId, guestId, guestToken }) => {
  if (userId && String(order.user_id) === String(userId)) return true;
  if (guestId && order.guest_id && String(order.guest_id) === String(guestId)) {
    return true;
  }
  if (guestToken && order.guest_token_hash) {
    return verifyGuestToken(guestToken, order.guest_token_hash);
  }
  return false;
};

/* ------------------------- recálculo server-side ------------------------- */

/**
 * Recalcula los items y subtotal desde Product (NO confía en cart.items).
 * Devuelve { items, subtotal, productsMap }.
 */
const rebuildItemsFromCart = async ({ cart, user, session }) => {
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    throw new BadRequestError("El carrito está vacío");
  }

  const productIds = [...new Set(cart.items.map((i) => String(i.product_id)))];

  const productsRaw = await Promise.all(
    productIds.map((id) =>
      Product.findById(id)
        .session(session || null)
        .lean(),
    ),
  );

  const products = productsRaw.filter(Boolean);

  const map = new Map(products.map((p) => [String(p._id), p]));

  const rebuiltItems = [];
  let subtotal = 0;

  for (const cartItem of cart.items) {
    const product = map.get(String(cartItem.product_id));
    if (!product) {
      throw new ConflictError(`Producto no encontrado: ${cartItem.name}`);
    }
    if (!product.is_active) {
      throw new ConflictError(`Producto inactivo: ${product.name}`);
    }

    const tiers = product?.pricing?.tiers || [];
    const pricing = calculateItemPricing({
      tiers,
      quantity: Number(cartItem.quantity || 0),
      product,
      user,
    });

    // Verificar stock disponible (sin descontar)
    await checkStockAvailability(
      { productId: product._id, quantity: pricing.quantity },
      session,
    );

    rebuiltItems.push({
      product_id: product._id,
      name: product.name,
      quantity: pricing.quantity,
      price: pricing.unit_price,
      original_price: pricing.original_unit_price,
      tier_label: pricing.tier_label,
      discount_applied: pricing.discount_applied,
      discount_percent: pricing.discount_percent,
      discount_amount_per_unit: pricing.discount_amount_per_unit,
      discount_source: pricing.discount_source,
      subtotal: pricing.subtotal,
      original_subtotal: pricing.original_subtotal,
      weight: product.weight || { value: 0, unit: "g" },
      dimensions: product.dimensions || {
        length: 0,
        width: 0,
        height: 0,
        unit: "cm",
      },
    });

    subtotal += pricing.subtotal;
  }

  return { items: rebuiltItems, subtotal, productsMap: map };
};

const rebuildItemsFromCustomBox = async ({ rawItems, user, session }) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new BadRequestError("La caja personalizada está vacía");
  }

  const productIds = [...new Set(rawItems.map((i) => String(i.product_id)))];
  const productsRaw = await Promise.all(
    productIds.map((id) =>
      Product.findById(id)
        .session(session || null)
        .lean(),
    ),
  );

  const products = productsRaw.filter(Boolean);
  const map = new Map(products.map((p) => [String(p._id), p]));

  const rebuiltItems = [];
  let subtotal = 0;

  for (const raw of rawItems) {
    const product = map.get(String(raw.product_id));
    if (!product) throw new ConflictError(`Producto no encontrado`);
    if (!product.is_active)
      throw new ConflictError(`Producto inactivo: ${product.name}`);

    const pricing = calculateItemPricing({
      tiers: product.pricing?.tiers || [],
      quantity: Number(raw.quantity || 0),
      product,
      user,
    });

    await checkStockAvailability(
      { productId: product._id, quantity: pricing.quantity },
      session,
    );

    rebuiltItems.push({
      product_id: product._id,
      name: product.name,
      quantity: pricing.quantity,
      price: pricing.unit_price,
      original_price: pricing.original_unit_price,
      tier_label: pricing.tier_label,
      discount_applied: pricing.discount_applied,
      discount_percent: pricing.discount_percent,
      discount_amount_per_unit: pricing.discount_amount_per_unit,
      discount_source: pricing.discount_source,
      subtotal: pricing.subtotal,
      original_subtotal: pricing.original_subtotal,
      weight: product.weight || { value: 0, unit: "g" },
      dimensions: product.dimensions || {
        length: 0,
        width: 0,
        height: 0,
        unit: "cm",
      },
    });

    subtotal += pricing.subtotal;
  }

  return { items: rebuiltItems, subtotal, productsMap: map };
};

/* -------------------------- cotización + cupón --------------------------- */

const computeOrderTotals = ({ subtotal, shippingAmount, discountAmount }) => {
  const sub = Math.max(0, Math.round(Number(subtotal || 0)));
  const ship = Math.max(0, Math.round(Number(shippingAmount || 0)));
  const disc = Math.max(0, Math.round(Number(discountAmount || 0)));
  const cappedDisc = Math.min(disc, sub);
  const total = sub + ship - cappedDisc;
  return {
    subtotal: sub,
    shipping_amount: ship,
    discount_amount: cappedDisc,
    total: Math.max(0, total),
  };
};

const resolveShippingAmount = ({ items, shipping }) => {
  const orderLike = { items, shipping };
  const quote = quoteShippingForOrder(orderLike);
  return {
    amount: Number(quote.selected?.amount || 0),
    service_name: quote.selected?.service_name || null,
    service_code: quote.selected?.service_code || null,
    carrier: quote.selected?.carrier || "blueexpress_manual",
  };
};

const resolveCouponDiscount = async ({
  couponCode,
  subtotal,
  userId,
  guestId,
  session,
}) => {
  let coupon = null;
  let autoApplied = false;

  if (couponCode) {
    coupon = await findCouponByCode(couponCode);
  } else if (userId) {
    coupon = await findFirstPurchaseAutoCoupon();
    autoApplied = Boolean(coupon);
  }

  if (!coupon) {
    return {
      coupon: null,
      discount: 0,
      info: couponCode
        ? { valid: false, message: "Cupón no encontrado" }
        : null,
    };
  }

  const validation = await validateCouponForUser({
    coupon,
    userId,
    subtotal,
  });

  if (!validation.valid) {
    return {
      coupon: null,
      discount: 0,
      info: couponCode ? validation : null,
    };
  }

  const discount = calculateCouponDiscount({ coupon, subtotal });

  return {
    coupon,
    discount,
    info: {
      valid: true,
      discount_preview: discount,
      code: coupon.code,
      auto_applied: autoApplied,
    },
  };
};

/* ----------------------------- create flow ------------------------------- */

const buildOrderPayload = ({
  identity,
  items,
  totals,
  customer,
  shipping,
  payment,
  coupon,
  notes,
  source,
  guestTokenHash,
}) => ({
  user_id: identity.userId || null,
  guest_id: identity.userId ? null : identity.guestId || null,
  guest_token_hash: identity.userId ? null : guestTokenHash,
  items,
  customer,
  shipping: {
    ...shipping,
    amount: totals.shipping_amount,
    carrier: shipping.carrier || "blueexpress_manual",
    service_name: shipping.service_name || null,
    service_code: shipping.service_code || null,
    tracking_number: null,
    shipment_status: null,
    label_url: null,
  },
  payment: {
    method: payment?.method || "webpay",
    platform: payment?.platform || "web",
    status: PAYMENT_STATUS.PENDING,
    transaction_id: null,
    token: null,
    buy_order: null,
    session_id: null,
    amount: totals.total,
    authorization_code: null,
    response_code: null,
    transaction_date: null,
    webhook_processed_at: null,
  },
  coupon: {
    code: coupon?.code || null,
    coupon_id: coupon?._id || null,
    discount_amount: totals.discount_amount,
  },
  subtotal: totals.subtotal,
  shipping_amount: totals.shipping_amount,
  discount_amount: totals.discount_amount,
  total: totals.total,
  status: ORDER_STATUS.PENDING,
  source,
  notes: String(notes || "").trim() || null,
});

/**
 * Crea una orden desde el carrito (transaccional).
 */
export const createOrderFromCart = async ({
  identity,
  user,
  customer: rawCustomer,
  shipping: rawShipping,
  payment,
  notes,
  couponCode,
}) => {
  const customer = buildCustomer(rawCustomer);
  const shipping = buildShipping(rawShipping);

  const errors = validateCustomerAndShipping({ customer, shipping });
  if (Object.keys(errors).length > 0) {
    throw new BadRequestError("Hay campos inválidos en el checkout", errors);
  }

  if (!identity.userId && !identity.guestId) {
    throw new BadRequestError("Identidad requerida (login o x-guest-id)");
  }

  const result = await withTransaction(async (session) => {
    const cartFilter = identity.userId
      ? { user_id: identity.userId, status: "active" }
      : { guest_id: identity.guestId, status: "active" };

    const cart = await Cart.findOne(cartFilter).session(session);
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      throw new BadRequestError("El carrito está vacío");
    }

    const { items, subtotal } = await rebuildItemsFromCart({
      cart,
      user,
      session,
    });

    const shippingResolved = resolveShippingAmount({
      items,
      shipping,
    });
    const shippingAmount = shippingResolved.amount;

    const couponResolved = await resolveCouponDiscount({
      couponCode,
      subtotal,
      userId: identity.userId,
      guestId: identity.guestId,
      session,
    });

    const totals = computeOrderTotals({
      subtotal,
      shippingAmount,
      discountAmount: couponResolved.discount,
    });

    const guestToken = identity.userId ? null : issueGuestToken();
    const guestTokenHash = guestToken ? hashGuestToken(guestToken) : null;

    const payload = buildOrderPayload({
      identity,
      items,
      totals,
      customer,
      shipping: {
        ...shipping,
        carrier: shippingResolved.carrier,
        service_name: shippingResolved.service_name,
        service_code: shippingResolved.service_code,
      },
      payment,
      coupon: couponResolved.coupon,
      notes,
      source: "cart",
      guestTokenHash,
    });

    const [order] = await Order.create([payload], { session });

    cart.status = "converted";
    await cart.save({ session });

    return { order, guestToken, couponInfo: couponResolved.info };
  });

  return result;
};

/**
 * Crea una orden desde una "custom box" (lista de items provista).
 */
export const createOrderFromCustomBox = async ({
  identity,
  user,
  items: rawItems,
  customer: rawCustomer,
  shipping: rawShipping,
  payment,
  notes,
  couponCode,
}) => {
  const customer = buildCustomer(rawCustomer);
  const shipping = buildShipping(rawShipping);

  const errors = validateCustomerAndShipping({ customer, shipping });
  if (Object.keys(errors).length > 0) {
    throw new BadRequestError("Hay campos inválidos en el checkout", errors);
  }

  if (!identity.userId && !identity.guestId) {
    throw new BadRequestError("Identidad requerida (login o x-guest-id)");
  }

  const result = await withTransaction(async (session) => {
    const { items, subtotal } = await rebuildItemsFromCustomBox({
      rawItems,
      user,
      session,
    });

    const shippingResolved = resolveShippingAmount({ items, shipping });
    const shippingAmount = shippingResolved.amount;

    const couponResolved = await resolveCouponDiscount({
      couponCode,
      subtotal,
      userId: identity.userId,
      guestId: identity.guestId,
      session,
    });

    const totals = computeOrderTotals({
      subtotal,
      shippingAmount,
      discountAmount: couponResolved.discount,
    });

    const guestToken = identity.userId ? null : issueGuestToken();
    const guestTokenHash = guestToken ? hashGuestToken(guestToken) : null;

    const payload = buildOrderPayload({
      identity,
      items,
      totals,
      customer,
      shipping: {
        ...shipping,
        carrier: shippingResolved.carrier,
        service_name: shippingResolved.service_name,
        service_code: shippingResolved.service_code,
      },
      payment,
      coupon: couponResolved.coupon,
      notes,
      source: "custom_box",
      guestTokenHash,
    });

    const [order] = await Order.create([payload], { session });

    return { order, guestToken, couponInfo: couponResolved.info };
  });

  return result;
};

/* ---------------------- finalización + transiciones ----------------------- */

/**
 * Llamado tras la confirmación de pago. IDEMPOTENTE:
 * - Si ya tiene webhook_processed_at, retorna sin hacer nada.
 * - Descuenta stock atómicamente, aplica cupón (si corresponde),
 *   marca status=paid y setea webhook_processed_at.
 */
export const finalizePaidOrder = async (orderId) => {
  return withTransaction(async (session) => {
    const order = await Order.findById(orderId)
      .select("+guest_token_hash")
      .session(session);

    if (!order) throw new NotFoundError("Orden no encontrada");

    if (order.payment?.webhook_processed_at) {
      logger.info(
        { orderId: String(order._id) },
        "finalizePaidOrder: ya procesado (idempotente)",
      );
      return order;
    }

    // Descontar stock por cada item
    for (const item of order.items) {
      if (!item.product_id) continue;
      await decrementStockAtomic(
        { productId: item.product_id, quantity: item.quantity },
        session,
      );
    }

    // Aplicar cupón si lo había (idempotente vía índice único)
    if (order.coupon?.coupon_id && Number(order.coupon?.discount_amount) > 0) {
      const couponDoc = await Coupon.findById(order.coupon.coupon_id).session(
        session,
      );

      if (couponDoc) {
        await applyCouponToOrder(
          {
            coupon: couponDoc,
            userId: order.user_id,
            guestId: order.guest_id,
            orderId: order._id,
            discountAmount: order.coupon.discount_amount,
          },
          session,
        );
      }
    }

    order.status = ORDER_STATUS.PAID;
    order.payment.status = PAYMENT_STATUS.APPROVED;
    order.payment.webhook_processed_at = new Date();

    await order.save({ session });

    logger.info(
      { orderId: String(order._id), total: order.total },
      "orden finalizada como pagada",
    );
    return order;
  });
};

/**
 * Cancela una orden: si estaba paid, repone stock y revierte cupón.
 */
export const cancelOrder = async ({
  orderId,
  reason,
  byAdmin = false,
  identity = {},
}) => {
  return withTransaction(async (session) => {
    const order = await Order.findById(orderId)
      .select("+guest_token_hash")
      .session(session);
    if (!order) throw new NotFoundError("Orden no encontrada");

    if (!byAdmin) {
      const owner = isOrderOwner({
        order,
        userId: identity.userId,
        guestId: identity.guestId,
        guestToken: identity.guestToken,
      });
      if (!owner)
        throw new ForbiddenError("No autorizado para cancelar esta orden");
    }

    const allowedFromCurrent = VALID_TRANSITIONS[order.status] || [];
    if (!allowedFromCurrent.includes(ORDER_STATUS.CANCELLED)) {
      throw new ConflictError(
        `No se puede cancelar una orden en estado "${order.status}"`,
      );
    }

    const wasPaid = PAID_STATUSES.includes(order.status);

    if (wasPaid) {
      for (const item of order.items) {
        if (!item.product_id) continue;
        await restoreStock(
          { productId: item.product_id, quantity: item.quantity },
          session,
        );
      }
      await revertCouponUsage({ orderId: order._id }, session);
    }

    order.status = ORDER_STATUS.CANCELLED;
    order.payment.status = PAYMENT_STATUS.REJECTED;
    order.cancelled_at = new Date();
    order.cancellation_reason = String(reason || "").trim() || null;

    await order.save({ session });

    logger.info(
      { orderId: String(order._id), wasPaid, byAdmin },
      "orden cancelada",
    );
    return order;
  });
};

/**
 * Transición genérica de estado validada por VALID_TRANSITIONS.
 */
export const transitionOrderStatus = async ({
  orderId,
  newStatus,
  byAdmin = false,
}) => {
  const order = await Order.findById(orderId);
  if (!order) throw new NotFoundError("Orden no encontrada");

  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new ConflictError(
      `Transición inválida: ${order.status} → ${newStatus}`,
    );
  }

  if (newStatus === ORDER_STATUS.CANCELLED) {
    return cancelOrder({ orderId, reason: "transition", byAdmin });
  }

  order.status = newStatus;
  await order.save();

  logger.info(
    { orderId: String(order._id), from: order.status, to: newStatus, byAdmin },
    "transición de orden aplicada",
  );
  return order;
};

/* --------------------------- utilidades públicas ------------------------- */

export const findOrderForOwner = async ({
  orderId,
  identity,
  includeGuestToken = false,
}) => {
  const query = Order.findById(orderId);
  if (includeGuestToken) query.select("+guest_token_hash");

  const order = await query;
  if (!order) throw new NotFoundError("Orden no encontrada");

  const owner = isOrderOwner({
    order,
    userId: identity.userId,
    guestId: identity.guestId,
    guestToken: identity.guestToken,
  });
  if (!owner) throw new ForbiddenError("No autorizado");
  return order;
};

export const verifyGuestOrderAccess = async ({ orderId, token }) => {
  const order = await Order.findById(orderId).select("+guest_token_hash");
  if (!order) throw new NotFoundError("Orden no encontrada");
  if (order.user_id) throw new ForbiddenError("Orden con usuario registrado");
  if (!verifyGuestToken(token, order.guest_token_hash)) {
    throw new ForbiddenError("Token de invitado inválido");
  }
  return order;
};

export { hashGuestToken, verifyGuestToken, issueGuestToken, isOrderOwner };
