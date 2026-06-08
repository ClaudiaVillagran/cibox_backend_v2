import { Router } from "express";

import { optionalAuth, protect, strictOptionalAuth } from "../middlewares/authMiddleware.js";
import { requireAdmin } from "../middlewares/roleMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { guestOrderLimiter } from "../middlewares/rateLimiters.js";

import {
  createFromCart,
  createFromCustomBox,
  getMyOrders,
  getOrderById,
  getGuestOrderById,
  cancelMyOrder,
  retryPayment,
  adminCancelOrder,
  adminUpdateOrderStatus,
  adminListOrders,
} from "../controllers/orderController.js";
import {
  createFromCartSchema,
  createFromCustomBoxSchema,
  cancelOrderSchema,
  orderIdParamSchema,
  guestOrderLookupSchema,
  retryPaymentSchema,
  adminUpdateStatusSchema,
} from "../validators/orderValidators.js";


const router = Router();

router.post(
  "/from-cart",
  strictOptionalAuth,   // invitados OK, pero token expirado → 401 para refresh
  validate(createFromCartSchema),
  createFromCart
);

router.post(
  "/from-custom-box",
  protect,
  validate(createFromCustomBoxSchema),
  createFromCustomBox
);

router.get("/me", protect, getMyOrders);

// ── Rutas admin (deben ir ANTES de /:id para evitar conflictos) ──────────────
router.get("/admin", protect, requireAdmin, adminListOrders);

router.post(
  "/admin/:id/cancel",
  protect,
  requireAdmin,
  validate(cancelOrderSchema),
  adminCancelOrder
);

router.patch(
  "/admin/:id/status",
  protect,
  requireAdmin,
  validate(adminUpdateStatusSchema),
  adminUpdateOrderStatus,
);
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/guest/:id",
  guestOrderLimiter,
  validate(guestOrderLookupSchema),
  getGuestOrderById
);

router.get(
  "/:id",
  optionalAuth,
  validate(orderIdParamSchema),
  getOrderById
);

router.post(
  "/:id/cancel",
  optionalAuth,
  validate(cancelOrderSchema),
  cancelMyOrder
);

router.post(
  "/:id/retry-payment",
  optionalAuth,
  validate(retryPaymentSchema),
  retryPayment
);

export default router;
