import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { requireAdmin } from "../middlewares/roleMiddleware.js";
import { validate } from "../middlewares/validate.js";
import {
  updateOrderStatusSchema,
  updateUserRoleSchema,
  toggleUserActiveSchema,
  salesSummaryQuerySchema,
  listOrdersSchema,
  listUsersSchema,
  exportOrdersQuerySchema,
  idParamSchema,
} from "../validators/adminValidators.js";
import {
  getSalesSummary,
  getTopSellingProducts,
  getDashboardMetrics,
  updateOrderStatus,
  listOrders,
  updateUserRole,
  listUsers,
  toggleUserActive,
  exportOrdersCSV,
} from "../controllers/adminController.js";

const router = Router();

// Todas con protect + requireAdmin
router.use(protect, requireAdmin);

// Reportes
router.get("/dashboard", getDashboardMetrics);
router.get("/sales-summary", validate({ query: salesSummaryQuerySchema }), getSalesSummary);
router.get("/top-products", validate({ query: salesSummaryQuerySchema }), getTopSellingProducts);

// Órdenes
router.get("/orders", validate({ query: listOrdersSchema }), listOrders);
router.get("/orders/export", validate({ query: exportOrdersQuerySchema }), exportOrdersCSV);
router.patch(
  "/orders/:id/status",
  validate({ params: idParamSchema, body: updateOrderStatusSchema }),
  updateOrderStatus
);

// Usuarios
router.get("/users", validate({ query: listUsersSchema }), listUsers);
router.patch(
  "/users/:id/role",
  validate({ params: idParamSchema, body: updateUserRoleSchema }),
  updateUserRole
);
router.patch(
  "/users/:id/active",
  validate({ params: idParamSchema, body: toggleUserActiveSchema }),
  toggleUserActive
);

export default router;
