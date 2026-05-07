import Order from "../models/Order.js";
import { getTransaction, webpayReturnUrl } from "../config/webpay.js";
import { logger } from "../utils/logger.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../utils/errors.js";
import { PAYMENT_STATUS, ORDER_STATUS } from "../utils/constants.js";
import { finalizePaidOrder } from "./orderService.js";

const buildBuyOrder = (orderId) => {
  const shortId = String(orderId).slice(-10);
  const shortTs = Date.now().toString().slice(-8);
  return `O${shortId}${shortTs}`.slice(0, 26);
};

const buildSessionId = ({ userId, guestId, orderId }) => {
  if (userId) return String(userId).slice(-20);
  if (guestId) return String(guestId).slice(-20);
  return `g_${String(orderId).slice(-18)}`;
};

/**
 * Crea una transacción Webpay para una orden pendiente.
 * - Ownership debe verificarse antes de invocar este servicio (controller).
 * - Si la orden ya tiene token activo y está en pending, podría re-usarse según política.
 */
export const createWebpayTransaction = async ({ order, platform }) => {
  if (!order) throw new NotFoundError("Orden no encontrada");
  if (order.status !== ORDER_STATUS.PENDING) {
    throw new ConflictError(
      "Solo se puede pagar una orden en estado pendiente",
    );
  }

  if (
    order.payment?.status === PAYMENT_STATUS.APPROVED ||
    order.payment?.webhook_processed_at
  ) {
    throw new ConflictError("La orden ya fue pagada");
  }

  const buyOrder = buildBuyOrder(order._id);
  const sessionId = buildSessionId({
    userId: order.user_id,
    guestId: order.guest_id,
    orderId: order._id,
  });
  const amount = Math.round(Number(order.total || 0));

  if (amount <= 0) {
    throw new BadRequestError("El monto a cobrar debe ser mayor a 0");
  }

  const tx = getTransaction();
  // console.log("WEBPAY RETURN URL ENVIADA A TRANSBANK:", webpayReturnUrl);
  // console.log("WEBPAY PLATFORM RECIBIDA:", platform);
  const response = await tx.create(
    buyOrder,
    sessionId,
    amount,
    webpayReturnUrl,
  );

  const safePlatform = ["web", "ios", "android"].includes(platform)
    ? platform
    : "web";

  order.payment = {
    ...(order.payment?.toObject
      ? order.payment.toObject()
      : order.payment || {}),
    method: "webpay",
    platform: safePlatform,
    status: PAYMENT_STATUS.PROCESSING,
    token: response.token,
    buy_order: buyOrder,
    session_id: sessionId,
    amount,
  };

  await order.save();

  logger.info(
    { orderId: String(order._id), buyOrder, amount },
    "Webpay transaction creada",
  );

  return {
    orderId: order._id,
    paymentToken: response.token,
    paymentUrl: response.url,
  };
};

/**
 * Confirma una transacción Webpay con lock optimista + validación amount.
 * Idempotente: si otro proceso ya hizo commit, lo detecta y retorna la orden actual.
 */
export const commitWebpayTransaction = async ({ token }) => {
  if (!token) throw new BadRequestError("Token requerido");

  const locked = await Order.collection.findOneAndUpdate(
    {
      "payment.token": token,
      "payment.status": { $in: ["pending", "processing"] },
    },
    { $set: { "payment.status": "processing_commit" } },
    { returnDocument: "after" },
  );

  const lockedDoc = locked?.value || locked;
  if (!lockedDoc) {
    const existing = await Order.findOne({ "payment.token": token });
    if (!existing) throw new NotFoundError("Orden no encontrada para el token");
    logger.info({ orderId: String(existing._id) }, "commit: idempotente");
    return existing;
  }

  if (!locked) {
    const existing = await Order.findOne({ "payment.token": token });
    if (!existing) throw new NotFoundError("Orden no encontrada para el token");
    logger.info({ orderId: String(existing._id) }, "commit: idempotente");
    return existing;
  }

  // if (!locked) {
  //   // No pudo bloquear: ya fue confirmada o cancelada.
  //   const existing = await Order.findOne({ "payment.token": token });
  //   if (!existing) throw new NotFoundError("Orden no encontrada para el token");
  //   logger.info(
  //     {
  //       orderId: String(existing._id),
  //       paymentStatus: existing.payment?.status,
  //       orderStatus: existing.status,
  //     },
  //     "commitWebpayTransaction: idempotente — ya procesada",
  //   );
  //   return existing;
  // }

  let response;
  try {
    const tx = getTransaction();
    response = await tx.commit(token);
  } catch (err) {
    // Liberar el lock como rejected si falla la llamada
    locked.payment.status = PAYMENT_STATUS.REJECTED;
    locked.payment.transaction_date = new Date();
    await locked.save();
    logger.error(
      { orderId: String(locked._id), err: err.message },
      "Webpay commit falló",
    );
    throw err;
  }

  const isAuthorized =
    response?.status === "AUTHORIZED" && Number(response?.response_code) === 0;

  const expectedAmount = Math.round(Number(locked.total || 0));
  const responseAmount = Math.round(Number(response?.amount || 0));
  const amountMatches = responseAmount === expectedAmount;

  // Persistir respuesta
  locked.payment.authorization_code = response?.authorization_code || null;
  locked.payment.transaction_date = response?.transaction_date
    ? new Date(response.transaction_date)
    : new Date();
  locked.payment.response_code = response?.response_code ?? null;
  locked.payment.buy_order = response?.buy_order || locked.payment.buy_order;
  locked.payment.session_id = response?.session_id || locked.payment.session_id;
  locked.payment.amount = responseAmount || expectedAmount;

  if (!isAuthorized || !amountMatches) {
    locked.payment.status = PAYMENT_STATUS.REJECTED;
    await locked.save();

    if (isAuthorized && !amountMatches) {
      logger.fatal(
        {
          orderId: String(locked._id),
          expected: expectedAmount,
          received: responseAmount,
          buy_order: response?.buy_order,
        },
        "ALERTA CRÍTICA: monto Webpay no coincide con total de la orden",
      );
    } else {
      logger.warn(
        {
          orderId: String(locked._id),
          status: response?.status,
          response_code: response?.response_code,
        },
        "Webpay rechazó la transacción",
      );
    }
    return locked;
  }

  // Autorizado y monto correcto → finalizar (idempotente)
  await finalizePaidOrder(locked._id);

  const refreshed = await Order.findById(locked._id);
  logger.info(
    { orderId: String(refreshed._id), total: refreshed.total },
    "Webpay commit aprobado y orden finalizada",
  );
  return refreshed;
};

/**
 * Wrapper para el return URL desde Transbank (GET o POST con token_ws).
 */
export const handleWebpayReturn = async ({
  token_ws,
  TBK_TOKEN,
  TBK_ORDEN_COMPRA,
}) => {
  if (token_ws) {
    const order = await commitWebpayTransaction({ token: token_ws });
    return { kind: "commit", order };
  }

  if (TBK_TOKEN && TBK_ORDEN_COMPRA) {
    // El usuario abandonó el flujo Webpay
    const order = await Order.findOne({
      "payment.buy_order": TBK_ORDEN_COMPRA,
    });
    if (!order) {
      throw new NotFoundError("Orden no encontrada para TBK_ORDEN_COMPRA");
    }
    if (
      order.payment?.status === PAYMENT_STATUS.APPROVED ||
      order.payment?.webhook_processed_at
    ) {
      return { kind: "abandoned_already_paid", order };
    }
    if (order.status === ORDER_STATUS.PENDING) {
      order.payment.status = PAYMENT_STATUS.REJECTED;
      await order.save();
    }
    return { kind: "abandoned", order };
  }

  throw new BadRequestError("Retorno Webpay inválido");
};

/**
 * Reintento de pago: para órdenes en pending con payment rejected o pending,
 * genera un nuevo token Webpay.
 */
export const retryPayment = async ({ order, platform }) => {
  if (!order) throw new NotFoundError("Orden no encontrada");
  if (order.status !== ORDER_STATUS.PENDING) {
    throw new ConflictError(
      "Solo se puede reintentar pago en órdenes pendientes",
    );
  }
  const ps = order.payment?.status;
  if (
    ps !== PAYMENT_STATUS.REJECTED &&
    ps !== PAYMENT_STATUS.PENDING &&
    ps !== PAYMENT_STATUS.PROCESSING
  ) {
    throw new ConflictError(`Estado de pago no permite reintento: ${ps}`);
  }

  // Resetea token y crea uno nuevo
  order.payment.authorization_code = null;
  order.payment.response_code = null;
  order.payment.status = PAYMENT_STATUS.PENDING;

  return createWebpayTransaction({ order, platform });
};
