import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requireAdmin } from "../middlewares/roleMiddleware.js";
import {
  emitForOrderSchema,
  voidDocumentSchema,
  taxDocumentIdParamsSchema,
  listMyDocumentsSchema,
} from "../validators/taxDocumentValidators.js";
import {
  emitForOrder,
  getMyDocuments,
  getDocumentById,
  voidDocument,
} from "../controllers/taxDocumentController.js";

const router = Router();

router.post(
  "/emit",
  protect,
  requireAdmin,
  validate({ body: emitForOrderSchema }),
  emitForOrder
);

router.get("/me", protect, validate({ query: listMyDocumentsSchema }), getMyDocuments);

router.get(
  "/:id",
  protect,
  validate({ params: taxDocumentIdParamsSchema }),
  getDocumentById
);

router.post(
  "/admin/void",
  protect,
  requireAdmin,
  validate({ body: voidDocumentSchema }),
  voidDocument
);

export default router;
