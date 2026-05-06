import { Router } from "express";

import { optionalAuth, protect } from "../middlewares/authMiddleware.js";
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
} from "../controllers/orderController.js";
import {
  createFromCartSchema,
  createFromCustomBoxSchema,
  cancelOrderSchema,
  orderIdParamSchema,
  guestOrderLookupSchema,
  retryPaymentSchema,
} from "../validators/orderValidators.js";


const router = Router();

router.post(
  "/from-cart",
  optionalAuth,
  validate(createFromCartSchema),
  createFromCart
);

router.post(
  "/from-custom-box",
  optionalAuth,
  validate(createFromCustomBoxSchema),
  createFromCustomBox
);

router.get("/me", protect, getMyOrders);

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

router.post(
  "/admin/:id/cancel",
  protect,
  requireAdmin,
  validate(cancelOrderSchema),
  adminCancelOrder
);

export default router;
