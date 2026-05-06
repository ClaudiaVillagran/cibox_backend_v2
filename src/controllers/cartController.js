import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

import { asyncHandler } from "../middlewares/errorHandler.js";
import { getRequestIdentity } from "../utils/ownership.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../utils/errors.js";
import { calculateItemPricing } from "../services/pricingService.js";

const ownerFilter = (identity) => {
  if (identity.userId) return { user_id: identity.userId, status: "active" };
  if (identity.guestId) return { guest_id: identity.guestId, status: "active" };
  return null;
};

const ownerAssign = (identity) => {
  if (identity.userId) {
    return { user_id: identity.userId, guest_id: null, status: "active" };
  }
  if (identity.guestId) {
    return { user_id: null, guest_id: identity.guestId, status: "active" };
  }
  return null;
};

const recalcCartTotal = (items) =>
  items.reduce((acc, it) => acc + Number(it.subtotal || 0), 0);

const buildCartItem = ({ product, quantity, user }) => {
  if (!product) throw new NotFoundError("Producto no encontrado");
  if (!product.is_active) throw new ConflictError("Producto inactivo");

  const tiers = product?.pricing?.tiers || [];
  const pricing = calculateItemPricing({
    tiers,
    quantity,
    product,
    user,
  });

  return {
    product_id: product._id,
    name: product.name,
    thumbnail: product.thumbnail || product.images?.[0] || "",
    quantity: pricing.quantity,
    unit_price: pricing.unit_price,
    subtotal: pricing.subtotal,
    tier_label: pricing.tier_label,
    product_type:
      product.product_type === "box" ? "box" : "individual",
    box_items: [],
  };
};

const requireIdentity = (identity) => {
  if (!identity.userId && !identity.guestId) {
    throw new BadRequestError(
      "No se pudo identificar el carrito. Falta token o x-guest-id válido."
    );
  }
};

/* ------------------------------- handlers -------------------------------- */

export const getCart = asyncHandler(async (req, res) => {
  const identity = getRequestIdentity(req);
  requireIdentity(identity);

  const filter = ownerFilter(identity);
  let cart = await Cart.findOne(filter);

  if (!cart) {
    cart = await Cart.create({
      ...ownerAssign(identity),
      items: [],
      total: 0,
    });
  }

  return res.status(200).json({
    success: true,
    data: cart,
  });
});

export const addItem = asyncHandler(async (req, res) => {
  const identity = getRequestIdentity(req);
  requireIdentity(identity);

  const { productId, quantity } = req.body;

  const product = await Product.findById(productId);
  if (!product || !product.is_active) {
    throw new NotFoundError("Producto no encontrado o inactivo");
  }

  const filter = ownerFilter(identity);
  let cart = await Cart.findOne(filter);
  if (!cart) {
    cart = await Cart.create({
      ...ownerAssign(identity),
      items: [],
      total: 0,
    });
  }

  const idx = cart.items.findIndex(
    (it) => String(it.product_id) === String(productId)
  );

  const existingQty = idx >= 0 ? Number(cart.items[idx].quantity || 0) : 0;
  const newQty = existingQty + Number(quantity);

  const built = buildCartItem({
    product,
    quantity: newQty,
    user: req.user,
  });

  if (idx >= 0) {
    cart.items[idx].quantity = built.quantity;
    cart.items[idx].unit_price = built.unit_price;
    cart.items[idx].subtotal = built.subtotal;
    cart.items[idx].tier_label = built.tier_label;
    cart.items[idx].name = built.name;
    cart.items[idx].thumbnail = built.thumbnail;
  } else {
    cart.items.push(built);
  }

  cart.total = recalcCartTotal(cart.items);
  await cart.save();

  return res.status(200).json({ success: true, data: cart });
});

export const updateItem = asyncHandler(async (req, res) => {
  const identity = getRequestIdentity(req);
  requireIdentity(identity);

  const { productId } = req.params;
  const { quantity } = req.body;

  const cart = await Cart.findOne(ownerFilter(identity));
  if (!cart) throw new NotFoundError("Carrito no encontrado");

  const idx = cart.items.findIndex(
    (it) => String(it.product_id) === String(productId)
  );
  if (idx < 0) throw new NotFoundError("Producto no existe en el carrito");

  const product = await Product.findById(productId);
  if (!product || !product.is_active) {
    throw new NotFoundError("Producto no encontrado o inactivo");
  }

  const built = buildCartItem({
    product,
    quantity: Number(quantity),
    user: req.user,
  });

  cart.items[idx].quantity = built.quantity;
  cart.items[idx].unit_price = built.unit_price;
  cart.items[idx].subtotal = built.subtotal;
  cart.items[idx].tier_label = built.tier_label;

  cart.total = recalcCartTotal(cart.items);
  await cart.save();

  return res.status(200).json({ success: true, data: cart });
});

export const removeItem = asyncHandler(async (req, res) => {
  const identity = getRequestIdentity(req);
  requireIdentity(identity);

  const { productId } = req.params;

  const cart = await Cart.findOne(ownerFilter(identity));
  if (!cart) throw new NotFoundError("Carrito no encontrado");

  const before = cart.items.length;
  cart.items = cart.items.filter(
    (it) => String(it.product_id) !== String(productId)
  );

  if (cart.items.length === before) {
    throw new NotFoundError("Producto no existe en el carrito");
  }

  cart.total = recalcCartTotal(cart.items);
  await cart.save();

  return res.status(200).json({ success: true, data: cart });
});

export const clearCart = asyncHandler(async (req, res) => {
  const identity = getRequestIdentity(req);
  requireIdentity(identity);

  const cart = await Cart.findOne(ownerFilter(identity));
  if (!cart) throw new NotFoundError("Carrito no encontrado");

  cart.items = [];
  cart.total = 0;
  await cart.save();

  return res.status(200).json({ success: true, data: cart });
});
