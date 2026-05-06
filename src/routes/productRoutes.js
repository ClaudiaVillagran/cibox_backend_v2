import { Router } from "express";
import { protect, optionalAuth } from "../middlewares/authMiddleware.js";
import { requireAdmin, requireVendor } from "../middlewares/roleMiddleware.js";
import { validate } from "../middlewares/validate.js";

import {
  createProductSchema,
  updateProductSchema,
  adminUpdateProductSchema,
  listProductsSchema,
  validateBoxItemsSchema,
  productIdParamSchema,
  vendorIdParamSchema,
  categoryIdParamSchema,
} from "../validators/productValidators.js";

import {
  createProduct,
  updateProduct,
  deleteProduct,
  toggleActive,
  getProducts,
  getProductById,
  getProductsByVendor,
  getProductsByCategory,
  searchProducts,
  validateBoxItems,
  getRecommendedProductsForMe,
  getVendorProducts,
  getFeaturedProducts,
} from "../controllers/productController.js";
const router = Router();

// Rutas específicas primero
router.get("/recommended", optionalAuth, getRecommendedProductsForMe);
router.get("/mine", protect, requireVendor, getVendorProducts);

router.get("/search", validate({ query: listProductsSchema }), searchProducts);
router.get("/featured", getFeaturedProducts);

router.get(
  "/by-vendor/:vendorId",
  validate({ params: vendorIdParamSchema }),
  getProductsByVendor,
);

router.get(
  "/by-category/:categoryId",
  validate({ params: categoryIdParamSchema }),
  getProductsByCategory,
);

router.post(
  "/validate-box",
  validate({ body: validateBoxItemsSchema }),
  validateBoxItems,
);

// Lista general
router.get("/", validate({ query: listProductsSchema }), getProducts);

// Crear
router.post(
  "/",
  protect,
  requireVendor,
  validate({ body: createProductSchema }),
  createProduct,
);

// Rutas dinámicas al final
router.patch(
  "/:id",
  protect,
  requireVendor,
  validate({ params: productIdParamSchema }),
  (req, res, next) => {
    const schema =
      req.user?.role === "admin"
        ? adminUpdateProductSchema
        : updateProductSchema;

    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  },
  updateProduct,
);

router.patch(
  "/:id/toggle-active",
  protect,
  requireAdmin,
  validate({ params: productIdParamSchema }),
  toggleActive,
);

router.delete(
  "/:id",
  protect,
  requireVendor,
  validate({ params: productIdParamSchema }),
  deleteProduct,
);

router.get("/:id", validate({ params: productIdParamSchema }), getProductById);

export default router;
