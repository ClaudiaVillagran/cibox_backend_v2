import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { protect, optionalAuth } from "../middlewares/authMiddleware.js";
import { requireAdmin } from "../middlewares/roleMiddleware.js";
import {
  requestRefundSchema,
  approveRefundSchema,
  rejectRefundSchema,
  listRefundsSchema,
  refundIdParamsSchema,
} from "../validators/refundValidators.js";
import {
  requestRefund,
  listMyRefunds,
  getRefund,
  listAll,
  approve,
  reject,
} from "../controllers/refundController.js";

const router = Router();

router.post("/", optionalAuth, validate({ body: requestRefundSchema }), requestRefund);

router.get("/me", protect, validate({ query: listRefundsSchema }), listMyRefunds);

router.get("/admin", protect, requireAdmin, validate({ query: listRefundsSchema }), listAll);

router.post(
  "/admin/approve",
  protect,
  requireAdmin,
  validate({ body: approveRefundSchema }),
  approve
);
router.post(
  "/admin/reject",
  protect,
  requireAdmin,
  validate({ body: rejectRefundSchema }),
  reject
);

router.get("/:id", protect, validate({ params: refundIdParamsSchema }), getRefund);

export default router;
