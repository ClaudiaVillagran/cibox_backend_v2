import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new UnauthorizedError());
  if (!roles.includes(req.user.role)) return next(new ForbiddenError("Rol insuficiente"));
  next();
};

export const requireAdmin = requireRole("admin");
export const requireVendor = requireRole("vendor", "admin");
