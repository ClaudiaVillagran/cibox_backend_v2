import { asyncHandler } from "../middlewares/errorHandler.js";
import * as authService from "../services/authService.js";

export const register = asyncHandler(async (req, res) => {
  const user = await authService.registerUser(req.body);
  res.status(201).json({
    success: true,
    data: { user },
    message: "Usuario registrado. Revisa tu correo para verificar tu cuenta.",
  });
});

export const login = asyncHandler(async (req, res) => {
  const device = req.headers["user-agent"] || null;
  const { user, accessToken, refreshToken } = await authService.loginUser({
    email: req.body.email,
    password: req.body.password,
    device,
  });
  res.status(200).json({
    success: true,
    data: { user, accessToken, refreshToken },
    message: "Login exitoso",
  });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logoutUser(req.user.id, req.body.refreshToken);
  res.status(200).json({
    success: true,
    message: "Sesión cerrada",
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const device = req.headers["user-agent"] || null;
  const tokens = await authService.refreshTokens(req.body.refreshToken, device);
  res.status(200).json({
    success: true,
    data: tokens,
    message: "Tokens renovados",
  });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.query.token);
  res.status(200).json({
    success: true,
    message: "Correo verificado correctamente",
  });
});

export const resendVerification = asyncHandler(async (req, res) => {
  await authService.resendVerification(req.body.email);
  // Siempre 200 — anti-enumeration
  res.status(200).json({
    success: true,
    message: "Si el correo existe y no está verificado, recibirás un nuevo enlace.",
  });
});

export const forgotPassword = asyncHandler(async (req, res) => {
    console.log("BODY RECIBIDO:", req.body);
  await authService.requestPasswordReset(req.body.email);
  // Siempre 200 — anti-enumeration
  res.status(200).json({
    success: true,
    message: "Si el correo existe, recibirás instrucciones para restablecer tu contraseña.",
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  res.status(200).json({
    success: true,
    message: "Contraseña actualizada correctamente",
  });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.id);
  res.status(200).json({
    success: true,
    data: { user },
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user.id, req.body);
  res.status(200).json({
    success: true,
    data: { user },
    message: "Perfil actualizado",
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(
    req.user.id,
    req.body.currentPassword,
    req.body.newPassword
  );
  res.status(200).json({
    success: true,
    message: "Contraseña actualizada. Vuelve a iniciar sesión.",
  });
});
