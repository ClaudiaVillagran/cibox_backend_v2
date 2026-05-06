import mongoose from "mongoose";
import { asyncHandler } from "../middlewares/errorHandler.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { ROLES } from "../utils/constants.js";

import Product from "../models/Product.js";
import Vendor from "../models/Vendor.js";
import { User } from "../models/User.js";

// Whitelists explícitas server-side (defensa en profundidad)
const VENDOR_UPDATE_FIELDS = new Set([
  "name",
  "description",
  "pricing",
  "category",
  "images",
  "thumbnail",
  "stock",
  "sku",
  "brand",
  "weight",
  "dimensions",
  "box_items",
  "product_type",
]);

const ADMIN_UPDATE_FIELDS = new Set([
  ...VENDOR_UPDATE_FIELDS,
  "is_active",
  "cibox_plus",
]);

const FORBIDDEN_FIELDS = new Set([
  "average_rating",
  "reviews_count",
  "vendor",
  "search_name",
  "_id",
  "created_at",
  "updated_at",
]);

const pickFields = (data, allowed) => {
  const out = {};
  for (const key of Object.keys(data)) {
    if (FORBIDDEN_FIELDS.has(key)) continue;
    if (allowed.has(key)) out[key] = data[key];
  }
  return out;
};

const buildSort = (sort) => {
  switch (sort) {
    case "price_asc":
      return { "pricing.tiers.0.price": 1, created_at: -1 };
    case "price_desc":
      return { "pricing.tiers.0.price": -1, created_at: -1 };
    case "newest":
      return { created_at: -1 };
    case "oldest":
      return { created_at: 1 };
    case "rating":
      return { average_rating: -1, reviews_count: -1 };
    case "popular":
      return { reviews_count: -1, average_rating: -1 };
    default:
      return { created_at: -1 };
  }
};

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildProductFilters = (q) => {
  const and = [];

  if (q.is_active === undefined) {
    and.push({ is_active: true });
  } else {
    and.push({ is_active: q.is_active });
  }

  if (q.category) and.push({ "category.id": q.category });
  if (q.vendor) and.push({ "vendor.id": q.vendor });
  if (q.product_type) and.push({ product_type: q.product_type });

  if (q.min_price !== undefined || q.max_price !== undefined) {
    const range = {};

    if (q.min_price !== undefined && q.min_price !== "") {
      range.$gte = Number(q.min_price);
    }

    if (q.max_price !== undefined && q.max_price !== "") {
      range.$lte = Number(q.max_price);
    }

    if (Object.keys(range).length > 0) {
      and.push({ "pricing.tiers.0.price": mongoose.trusted(range) });
    }
  }
  if (q.search) {
    const term = String(q.search).trim();

    if (term) {
      const regex = new RegExp(escapeRegex(term), "i");

      and.push({
        $or: [
          { name: regex },
          { search_name: regex },
          { description: regex },
          { brand: regex },
          { "category.name": regex },
        ],
      });
    }
  }

  return and.length ? { $and: and } : {};
};
const validateBoxItemsServer = async (items, currentProductId = null) => {
  if (!Array.isArray(items) || items.length < 2) {
    throw new BadRequestError("La caja debe incluir al menos 2 productos");
  }
  const ids = items.map((i) => String(i.product_id));
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new BadRequestError("box_items contiene productos duplicados");
  }
  if (currentProductId && unique.has(String(currentProductId))) {
    throw new BadRequestError("Una caja no puede incluirse a sí misma");
  }
  const products = await Product.find({
    _id: { $in: ids },
    is_active: true,
  })
    .select("_id product_type")
    .lean();
  if (products.length !== ids.length) {
    throw new BadRequestError(
      "Uno o más productos de la caja no existen o están inactivos",
    );
  }
  if (products.some((p) => p.product_type === "box")) {
    throw new BadRequestError(
      "No se permite incluir cajas dentro de otra caja",
    );
  }
};

const getVendorDisplayName = (vendor) =>
  vendor?.name ||
  vendor?.business_name ||
  vendor?.store_name ||
  vendor?.shop_name ||
  vendor?.company_name ||
  "Vendedor";

const resolveVendorForRequest = async (req) => {
  if (req.user.role === ROLES.ADMIN) {
    if (req.body.vendor?.id) {
      const v = await Vendor.findById(req.body.vendor.id).lean();
      if (!v) throw new BadRequestError("Vendor no existe");

      return {
        id: String(v._id),
        name: getVendorDisplayName(v),
      };
    }

    throw new BadRequestError("Admin debe enviar vendor.id");
  }

  const v = await Vendor.findOne({ user_id: req.user.id }).lean();

  if (!v) throw new ForbiddenError("Usuario no tiene vendor asociado");
  if (!v.is_active) throw new ForbiddenError("Vendor inactivo");

  return {
    id: String(v._id),
    name: getVendorDisplayName(v),
  };
};

export const createProduct = asyncHandler(async (req, res) => {
  const vendor = await resolveVendorForRequest(req);

  const productType = req.body.product_type || "simple";
  if (productType === "box") {
    await validateBoxItemsServer(req.body.box_items || []);
  }

  const search_name = String(req.body.name || "")
    .trim()
    .toLowerCase();

  const doc = await Product.create({
    ...req.body,
    product_type: productType,
    search_name,
    vendor,
  });

  logger.info(
    { product_id: String(doc._id), vendor_id: vendor.id },
    "product created",
  );
  res
    .status(201)
    .json({ success: true, data: doc, message: "Producto creado" });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new NotFoundError("Producto no encontrado");

  let allowed;
  if (req.user.role === ROLES.ADMIN) {
    allowed = ADMIN_UPDATE_FIELDS;
  } else if (req.user.role === ROLES.VENDOR) {
    const myVendor = await Vendor.findOne({ user_id: req.user.id })
      .select("_id")
      .lean();
    if (!myVendor) throw new ForbiddenError("Vendor no encontrado");
    if (String(product.vendor?.id) !== String(myVendor._id)) {
      throw new ForbiddenError("No puedes editar este producto");
    }
    allowed = VENDOR_UPDATE_FIELDS;
  } else {
    throw new ForbiddenError("Rol insuficiente");
  }

  const update = pickFields(req.body, allowed);

  if (update.name) {
    update.search_name = String(update.name).trim().toLowerCase();
  }

  const finalType = update.product_type || product.product_type;
  if (finalType === "box") {
    const items =
      update.box_items !== undefined ? update.box_items : product.box_items;
    await validateBoxItemsServer(items, product._id);
  } else if (update.product_type === "simple") {
    update.box_items = [];
  }

  const updated = await Product.findByIdAndUpdate(product._id, update, {
    new: true,
    runValidators: true,
  }).lean();

  logger.info(
    { product_id: String(product._id), by: req.user.id },
    "product updated",
  );
  res.json({ success: true, data: updated, message: "Producto actualizado" });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new NotFoundError("Producto no encontrado");

  if (req.user.role !== ROLES.ADMIN) {
    const myVendor = await Vendor.findOne({ user_id: req.user.id })
      .select("_id")
      .lean();
    if (!myVendor || String(product.vendor?.id) !== String(myVendor._id)) {
      throw new ForbiddenError("No puedes eliminar este producto");
    }
  }

  product.is_active = false;
  await product.save();

  logger.info({ product_id: String(product._id) }, "product soft-deleted");
  res.json({ success: true, data: product, message: "Producto desactivado" });
});

export const toggleActive = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new NotFoundError("Producto no encontrado");
  product.is_active = !product.is_active;
  await product.save();
  logger.info(
    { product_id: String(product._id), is_active: product.is_active },
    "product toggled",
  );
  res.json({ success: true, data: product });
});

export const getProducts = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const filters = buildProductFilters(req.query);
  const sort = buildSort(req.query.sort);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Product.find(filters).sort(sort).skip(skip).limit(limit).lean(),
    Product.countDocuments(filters),
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
    },
  });
});

export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).lean();

  if (!product) throw new NotFoundError("Producto no encontrado");

  if (product.product_type === "box" && Array.isArray(product.box_items)) {
    const ids = product.box_items
      .map((item) => item.product_id)
      .filter((id) => mongoose.Types.ObjectId.isValid(String(id)));

    const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));

    const boxProducts = await Product.find({
      _id: mongoose.trusted({ $in: objectIds }),
      is_active: true,
    })
      .select("_id name thumbnail images pricing brand")
      .lean();

    const productsMap = new Map(boxProducts.map((p) => [String(p._id), p]));

    product.box_items = product.box_items.map((item) => {
      const found = productsMap.get(String(item.product_id));

      return {
        ...item,
        product_id: found || item.product_id,
      };
    });
  }

  res.json({ success: true, data: product });
});

export const getProductsByVendor = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const filters = { "vendor.id": req.params.vendorId, is_active: true };

  const [items, total] = await Promise.all([
    Product.find(filters)
      .sort({ created_at: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
    Product.countDocuments(filters),
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page: p,
        limit: l,
        total,
        total_pages: Math.ceil(total / l),
      },
    },
  });
});

export const getProductsByCategory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const filters = { "category.id": req.params.categoryId, is_active: true };

  const [items, total] = await Promise.all([
    Product.find(filters)
      .sort({ created_at: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
    Product.countDocuments(filters),
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page: p,
        limit: l,
        total,
        total_pages: Math.ceil(total / l),
      },
    },
  });
});

export const searchProducts = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const filters = buildProductFilters(req.query);
  const sort = buildSort(req.query.sort);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Product.find(filters).sort(sort).skip(skip).limit(limit).lean(),
    Product.countDocuments(filters),
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    },
  });
});
export const validateBoxItems = asyncHandler(async (req, res) => {
  await validateBoxItemsServer(req.body.items);
  res.json({ success: true, message: "Items válidos" });
});

// Recomendados sin N+1: consolida productIds y ejecuta una sola query
export const getRecommendedProductsForMe = asyncHandler(async (req, res) => {
  const userId = req.user?.id || null;
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  if (!userId) {
    const fallback = await Product.find({
      is_active: true,
      product_type: "simple",
    })
      .sort({ average_rating: -1, reviews_count: -1, created_at: -1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      data: {
        based_on: "fallback_without_login",
        items: fallback,
      },
    });
  }

  // Cargar modelos opcionales (pueden no existir en v2)
  let Favorite = null;
  let Pantry = null;
  let Order = null;
  try {
    Favorite = (await import("../models/Favorite.js")).default;
  } catch {
    Favorite = null;
  }
  try {
    Pantry = (await import("../models/Pantry.js")).default;
  } catch {
    Pantry = null;
  }
  try {
    Order = (await import("../models/Order.js")).default;
  } catch {
    Order = null;
  }

  const [favorites, pantry, orders] = await Promise.all([
    Favorite
      ? Favorite.find({ user_id: userId }).select("product_id").lean()
      : Promise.resolve([]),
    Pantry
      ? Pantry.findOne({ user_id: userId }).select("items.product_id").lean()
      : Promise.resolve(null),
    Order
      ? Order.find({ user_id: userId }).select("items.product_id").lean()
      : Promise.resolve([]),
  ]);

  const allIds = new Set();
  for (const f of favorites) {
    if (f.product_id) allIds.add(String(f.product_id));
  }
  if (pantry?.items?.length) {
    for (const it of pantry.items) {
      if (it.product_id) allIds.add(String(it.product_id));
    }
  }
  for (const o of orders) {
    for (const it of o.items || []) {
      if (it.product_id) allIds.add(String(it.product_id));
    }
  }

  // Una sola query para todos los productos referenciados
  const validIds = Array.from(allIds).filter((id) =>
    mongoose.Types.ObjectId.isValid(id),
  );

  const objectIds = validIds.map((id) => new mongoose.Types.ObjectId(id));

  console.log("objectIds", objectIds);
  const referenced = objectIds.length
    ? await Product.find({
        _id: mongoose.trusted({ $in: objectIds }),
      })
        .select("_id category")
        .lean()
    : [];

  console.log("referenced", referenced);
  // Ponderar categorías en memoria
  const categoryCount = {};
  const excluded = new Set();
  for (const p of referenced) {
    if (p.category?.id) {
      categoryCount[p.category.id] = (categoryCount[p.category.id] || 0) + 1;
    }
    excluded.add(String(p._id));
  }

  const sortedCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);
  console.log("sortedCategories", sortedCategories);

  let recommended = [];
  if (sortedCategories.length) {
    recommended = await Product.find({
      is_active: true,
      "category.id": mongoose.trusted({ $in: sortedCategories }),
      _id: mongoose.trusted({
        $nin: Array.from(excluded).map((id) => new mongoose.Types.ObjectId(id)),
      }),
    })
      .sort({ average_rating: -1, reviews_count: -1, created_at: -1 })
      .limit(limit)
      .lean();
  }

  if (recommended.length < limit) {
    const fallback = await Product.find({
      is_active: true,
      _id: mongoose.trusted({
        $nin: [...excluded, ...recommended.map((r) => String(r._id))].map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
      }),
    })
      .sort({ average_rating: -1, reviews_count: -1, created_at: -1 })
      .limit(limit - recommended.length)
      .lean();
    recommended = [...recommended, ...fallback];
  }

  res.json({
    success: true,
    data: {
      based_on: sortedCategories.length
        ? { favorite_categories: sortedCategories }
        : "fallback_top_rated",
      items: recommended,
    },
  });
});

export const getVendorProducts = asyncHandler(async (req, res) => {
  const myVendor = await Vendor.findOne({ user_id: req.user.id })
    .select("_id name")
    .lean();

  if (!myVendor) throw new NotFoundError("Vendor no encontrado");

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const filters = {
    "vendor.id": String(myVendor._id),
  };

  if (req.query.is_active !== undefined) {
    filters.is_active =
      req.query.is_active === "true" || req.query.is_active === true;
  }

  const [items, total] = await Promise.all([
    Product.collection
      .find(filters)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),

    Product.collection.countDocuments(filters),
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    },
  });
});
export const getFeaturedProducts = async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 8));

  const items = await Product.find({
    is_active: true,
    featured: true,
    stock: mongoose.trusted({ $gt: 0 }),
  })
    .sort({
      created_at: -1,
    })
    .limit(limit)
    .lean();

  return res.status(200).json({
    success: true,
    items,
  });
};
