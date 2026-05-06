import rateLimit from "express-rate-limit";

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: "TOO_MANY_REQUESTS", message: "Demasiadas solicitudes, intenta más tarde" },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, code: "AUTH_RATE_LIMIT", message: "Demasiados intentos de autenticación, espera 15 minutos" },
});

export const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: "EMAIL_RATE_LIMIT", message: "Demasiados correos enviados, intenta más tarde" },
});

export const guestOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: "TOO_MANY_REQUESTS", message: "Demasiadas consultas de orden" },
});
