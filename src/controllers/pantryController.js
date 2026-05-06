import { asyncHandler } from "../middlewares/errorHandler.js";
import { Pantry } from "../models/Pantry.js";
import { Product } from "../models/Product.js";
import { Cart } from "../models/Cart.js";
import { User } from "../models/User.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";
import { calculateItemPricing } from "../services/pricingService.js";
import { logger } from "../utils/logger.js";

const fetchUser = async (req) => {
  if (!req.user?.id) return null;
  return User.findById(req.user.id).lean();
};

const getOrCreatePantry = async (userId) => {
  let pantry = await Pantry.findOne({ user_id: userId });
  if (!pantry) {
    pantry = await Pantry.create({ user_id: userId, items: [] });
  }
  return pantry;
};

export const getMyPantry = asyncHandler(async (req, res) => {
  const pantry = await getOrCreatePantry(req.user.id);
  return res.status(200).json({
    success: true,
    data: { pantry: pantry.toObject() },
  });
});

export const addItem = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, auto_reorder, frequency_days } = req.body;

  const product = await Product.findById(productId)
    .select("_id is_active")
    .lean();
  if (!product || product.is_active === false) {
    throw new NotFoundError("Producto no encontrado o inactivo");
  }

  const pantry = await getOrCreatePantry(req.user.id);
  const idx = pantry.items.findIndex(
    (it) => String(it.product_id) === String(productId)
  );

  if (idx >= 0) {
    pantry.items[idx].quantity = quantity;
    if (auto_reorder !== undefined) pantry.items[idx].auto_reorder = auto_reorder;
    if (frequency_days !== undefined) pantry.items[idx].frequency_days = frequency_days;
  } else {
    pantry.items.push({
      product_id: productId,
      quantity,
      auto_reorder: auto_reorder ?? false,
      frequency_days: frequency_days ?? 30,
    });
  }

  await pantry.save();

  return res.status(201).json({
    success: true,
    data: { pantry: pantry.toObject() },
    message: "Producto agregado a la despensa",
  });
});

export const updateItem = asyncHandler(async (req, res) => {
  const pantry = await Pantry.findOne({ user_id: req.user.id });
  if (!pantry) throw new NotFoundError("Despensa no encontrada");

  const idx = pantry.items.findIndex(
    (it) => String(it.product_id) === String(req.params.productId)
  );
  if (idx < 0) throw new NotFoundError("Producto no existe en la despensa");

  const { quantity, auto_reorder, frequency_days, last_purchased_at } = req.body;
  if (quantity !== undefined) pantry.items[idx].quantity = quantity;
  if (auto_reorder !== undefined) pantry.items[idx].auto_reorder = auto_reorder;
  if (frequency_days !== undefined) pantry.items[idx].frequency_days = frequency_days;
  if (last_purchased_at !== undefined) {
    pantry.items[idx].last_purchased_at = new Date(last_purchased_at);
  }

  await pantry.save();

  return res.status(200).json({
    success: true,
    data: { pantry: pantry.toObject() },
    message: "Producto actualizado",
  });
});

export const removeItem = asyncHandler(async (req, res) => {
  const pantry = await Pantry.findOne({ user_id: req.user.id });
  if (!pantry) throw new NotFoundError("Despensa no encontrada");

  const before = pantry.items.length;
  pantry.items = pantry.items.filter(
    (it) => String(it.product_id) !== String(req.params.productId)
  );

  if (pantry.items.length === before) {
    throw new NotFoundError("Producto no existe en la despensa");
  }

  await pantry.save();

  return res.status(200).json({
    success: true,
    data: { pantry: pantry.toObject() },
    message: "Producto eliminado de la despensa",
  });
});

/**
 * Convierte la despensa en un Cart activo aplicando descuentos `fromPantry: true`.
 * El usuario luego completa el flujo en /api/cart -> /api/orders -> Webpay.
 * NO descuenta stock aquí; eso lo hace finalizePaidOrder en el webhook de pago.
 */
export const checkoutPantry = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const pantry = await Pantry.findOne({ user_id: userId });

  if (!pantry || !pantry.items.length) {
    throw new BadRequestError("La despensa está vacía");
  }

  const user = await fetchUser(req);
  const cartItems = [];

  for (const pItem of pantry.items) {
    const product = await Product.findById(pItem.product_id);
    if (!product) {
      throw new NotFoundError(`Producto no encontrado en despensa: ${pItem.product_id}`);
    }
    if (product.is_active === false) {
      throw new BadRequestError(`Producto inactivo: ${product.name}`);
    }
    if (Number(product.stock || 0) < Number(pItem.quantity || 0)) {
      throw new BadRequestError(
        `Stock insuficiente para ${product.name}. Disponible: ${product.stock}`
      );
    }

    const pricing = calculateItemPricing({
      tiers: product.pricing.tiers,
      quantity: pItem.quantity,
      product,
      user,
      fromPantry: true,
    });

    cartItems.push({
      product_id: product._id,
      name: product.name,
      thumbnail: product.thumbnail || product.images?.[0] || "",
      quantity: pItem.quantity,
      unit_price: pricing.unit_price,
      subtotal: pricing.subtotal,
      tier_label: pricing.tier_label,
      product_type: "individual",
      box_items: [],
    });
  }

  const total = cartItems.reduce((acc, it) => acc + Number(it.subtotal || 0), 0);

  // Cierra carritos activos previos del usuario y crea uno nuevo desde la despensa
  await Cart.updateMany(
    { user_id: userId, status: "active" },
    { $set: { status: "abandoned" } }
  );

  const cart = await Cart.create({
    user_id: userId,
    status: "active",
    items: cartItems,
    total,
  });

  logger.info(
    { user_id: userId, cart_id: String(cart._id), items: cartItems.length },
    "pantry.checkout.cart_created"
  );

  return res.status(201).json({
    success: true,
    data: {
      cart: cart.toObject(),
      next_step: {
        endpoint: "/api/orders",
        method: "POST",
        note: "Crea la orden desde el cart_id devuelto y procede al pago.",
      },
    },
    message: "Carrito generado desde la despensa con descuentos aplicados",
  });
});
