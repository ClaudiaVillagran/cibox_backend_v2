import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";

const extractToken = (req) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
};

export const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) throw new UnauthorizedError("Token requerido");

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw new UnauthorizedError("Token inválido o expirado");
    }

    const user = await User.findById(decoded.id).select("_id email role is_active email_verified").lean();
    if (!user) throw new UnauthorizedError("Usuario no encontrado");
    if (user.is_active === false) throw new ForbiddenError("Usuario desactivado");

    req.user = {
      id: String(user._id),
      email: user.email,
      role: user.role,
      email_verified: user.email_verified,
    };
    next();
  } catch (err) {
    next(err);
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return next();

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("_id email role is_active email_verified").lean();
      if (user && user.is_active !== false) {
        req.user = {
          id: String(user._id),
          email: user.email,
          role: user.role,
          email_verified: user.email_verified,
        };
      }
    } catch {
      // token inválido → se sigue como invitado
    }
    next();
  } catch (err) {
    next(err);
  }
};

export const requireEmailVerified = (req, res, next) => {
  if (!req.user?.email_verified) {
    return next(new ForbiddenError("Email no verificado"));
  }
  next();
};
