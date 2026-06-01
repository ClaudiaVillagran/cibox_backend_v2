import { Product } from "../models/Product.js";
import { Vendor } from "../models/Vendor.js";
import { Category } from "../models/Category.js";
import { normalizeText } from "../utils/normalizeText.js";
import { logger } from "../utils/logger.js";

const products = [
  {
    sku: "15899",
    name: "GALLETA AGUA COSTA 175G",
    weightKg: 0.17,
    length: 10,
    width: 10,
    height: 10,
    price: 1127,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/Galletas-de-agua-Costa-175-g.webp",
    ],
    brand: "COSTA",
    unitLabel: "unidad",
  },
  {
    sku: "15901",
    name: "GALLETA ALFAJOR COCKTAIL TIO NINO 130 UN",
    weightKg: 1,
    length: 20,
    width: 15,
    height: 10,
    price: 4078,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/GALLETA-ALFAJOR-COCKTAIL-TIO-NINO-130-UN.jpg",
    ],
    brand: "TIO NINO",
    unitLabel: "unidad",
  },
  {
    sku: "15903",
    name: "GALLETA ALFAJOR GRAN VALLE 700G 100U",
    weightKg: 0.7,
    length: 10,
    width: 10,
    height: 10,
    price: 3713,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/GALLETA-ALFAJOR-GRAN-VALLE-700G-100U.jpg",
    ],
    brand: "GRAN VALLE",
    unitLabel: "unidad",
  },
  {
    sku: "15907",
    name: "GALLETA ALFAJOR TIO NINO 800G 100U",
    weightKg: 0.8,
    length: 10,
    width: 10,
    height: 10,
    price: 4415,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/GALLETA-ALFAJOR-TIO-NINO-800G-100U.jpg",
    ],
    brand: "TIO NINO",
    unitLabel: "unidad",
  },
  {
    sku: "15909",
    name: "GALLETA BOCADO NIK COSTA 71G",
    weightKg: 0.07,
    length: 10,
    width: 10,
    height: 10,
    price: 596,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/Galleta-Costa-Nik-Bocado-71-g.png",
    ],
    brand: "COSTA",
    unitLabel: "unidad",
  },
  {
    sku: "15911",
    name: "GALLETA CHAMPAÑA COSTA 140G",
    weightKg: 0.14,
    length: 10,
    width: 10,
    height: 10,
    price: 1732,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/GALLETA-CHAMPANA-COSTA-140G.webp",
    ],
    brand: "COSTA",
    unitLabel: "unidad",
  },
  {
    sku: "15912",
    name: "GALLETA CHAMPAÑA GULLON 200G",
    weightKg: 0.2,
    length: 10,
    width: 10,
    height: 10,
    price: 2236,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/GALLETA-CHAMPANA-GULLON-200G.webp",
    ],
    brand: "GULLON",
    unitLabel: "unidad",
  },
  {
    sku: "15913",
    name: "GALLETA CHOCOLATE COSTA 140G",
    weightKg: 0.14,
    length: 10,
    width: 10,
    height: 10,
    price: 834,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/Galleta-Chocolate-Costa.jpg",
    ],
    brand: "COSTA",
    unitLabel: "unidad",
  },
  {
    sku: "15914",
    name: "GALLETA COCO COSTA 125 GR",
    weightKg: 0.12,
    length: 10,
    width: 10,
    height: 10,
    price: 898,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/WhatsApp-Image-2026-03-22-at-7.01.57-PM.jpg",
    ],
    brand: "COSTA",
    unitLabel: "unidad",
  },
  {
    sku: "15915",
    name: "GALLETA CRACKELET COSTA 85G",
    weightKg: 0.09,
    length: 10,
    width: 10,
    height: 10,
    price: 596,
    categoryPath: "Galletas y chocolates",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/wmtcl.jpg"],
    brand: "COSTA",
    unitLabel: "unidad",
  },
  {
    sku: "15917",
    name: "GALLETA FRAC CHOCOLATE 130G",
    weightKg: 0.13,
    length: 10,
    width: 10,
    height: 10,
    price: 781,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/GALLETA-FRAC-CHOCOLATE-130G.jpg",
    ],
    brand: "COSTA",
    unitLabel: "unidad",
  },
  {
    sku: "15918",
    name: "GALLETA FRAC CLASICA 130G",
    weightKg: 0.13,
    length: 10,
    width: 10,
    height: 10,
    price: 781,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/GALLETA-FRAC-CLASICA-130G.jpg",
    ],
    brand: "COSTA",
    unitLabel: "unidad",
  },
  {
    sku: "15919",
    name: "GALLETA FRAC VAINILLA 130G",
    weightKg: 0.13,
    length: 10,
    width: 10,
    height: 10,
    price: 781,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/GALLETA-FRAC-VAINILLA-130G.jpg",
    ],
    brand: "COSTA",
    unitLabel: "unidad",
  },
  {
    sku: "15920",
    name: "GALLETA GRETEL YOGHURT COSTA 85G",
    weightKg: 0.09,
    length: 10,
    width: 10,
    height: 10,
    price: 1334,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/GALLETA-GRETEL-FRUTILLA-85GR-COSTA.jpg",
    ],
    brand: "COSTA",
    unitLabel: "unidad",
  },
  {
    sku: "15921",
    name: "GALLETA KUKI CLASICA 120G",
    weightKg: 0.12,
    length: 10,
    width: 10,
    height: 10,
    price: 1286,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/Galletas-Chips-Kuky-Clasica-120-g.webp",
    ],
    brand: "MCKAY",
    unitLabel: "unidad",
  },
  {
    sku: "15922",
    name: "GALLETA LIMON COSTA 140G",
    weightKg: 0.14,
    length: 10,
    width: 10,
    height: 10,
    price: 965,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/Galletas-Costa-limon-140-g.webp",
    ],
    brand: "COSTA",
    unitLabel: "unidad",
  },
  {
    sku: "15925",
    name: "GALLETA MANTEQUILLA COSTA 140G",
    weightKg: 0.14,
    length: 10,
    width: 10,
    height: 10,
    price: 834,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/Galletas-Costa-mantequilla-140-g.webp",
    ],
    brand: "COSTA",
    unitLabel: "unidad",
  },
  {
    sku: "15926",
    name: "GALLETA OBSESION COSTA 85G",
    weightKg: 0.09,
    length: 10,
    width: 10,
    height: 10,
    price: 1321,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/Galletas-Costa-Obsesion-85-g.webp",
    ],
    brand: "COSTA",
    unitLabel: "unidad",
  },
  {
    sku: "15929",
    name: "GALLETA SODA COSTA 160G",
    weightKg: 0.16,
    length: 10,
    width: 10,
    height: 10,
    price: 1058,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/GALLETA-SODA-160GR-COSTA.jpg",
    ],
    brand: "COSTA",
    unitLabel: "unidad",
  },
  {
    sku: "15931",
    name: "GALLETA VAINILLA TRITON 116G",
    weightKg: 0.12,
    length: 10,
    width: 10,
    height: 10,
    price: 916,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/GALLETA-VAINILLA-TRITON-116G.webp",
    ],
    brand: "MCKAY",
    unitLabel: "unidad",
  },
  {
    sku: "15932",
    name: "GALLETA VINO COSTA 160G",
    weightKg: 0.16,
    length: 10,
    width: 10,
    height: 10,
    price: 898,
    categoryPath: "Galletas y chocolates",
    images: [
      "https://cibox.cl/wp-content/uploads/2026/01/GALLETA-VINO-COSTA-160G.jpg",
    ],
    brand: "COSTA",
    unitLabel: "unidad",
  },
];
const buildDescription = (name, brand, categoryName) => {
  return `${name}${brand ? ` de marca ${brand}` : ""}${
    categoryName ? ` en categoría ${categoryName}` : ""
  }.`;
};

const findApprovedVendor = async () => {
  const vendor = await Vendor.findOne({
    is_active: true,
  }).lean();

  if (!vendor) {
    throw new Error("No existe un vendor activo para asignar a los productos");
  }

  const vendorName =
    vendor.name ||
    vendor.store_name ||
    vendor.business_name ||
    vendor.shop_name ||
    vendor.company_name ||
    "Aletheia Fit";

  return {
    id: String(vendor._id),
    name: vendorName,
  };
};
const resolveCategoryByPath = async (categoryPath) => {
  if (!categoryPath) {
    throw new Error("Falta categoryPath en un producto");
  }

  const parts = categoryPath
    .split(">")
    .map((item) => item.trim())
    .filter(Boolean);

  let parent = null;
  let found = null;

  for (const part of parts) {
    found = await Category.findOne({
      name: part,
      parent_id: parent ? parent._id : null,
      is_active: true,
    });

    if (!found) {
      throw new Error(
        `No se encontró la categoría/subcategoría: ${categoryPath}`,
      );
    }

    parent = found;
  }

  return found;
};

const upsertProduct = async (rawProduct, vendorData) => {
  const category = await resolveCategoryByPath(rawProduct.categoryPath);

  const images = Array.isArray(rawProduct.images) ? rawProduct.images : [];
  const thumbnail = images[0] || "";

  const payload = {
    vendor: vendorData,
    product_type: "simple",
    name: rawProduct.name,
    images,
    thumbnail,
    search_name: normalizeText(rawProduct.name),
    description: buildDescription(
      rawProduct.name,
      rawProduct.brand,
      category.name,
    ),
    category: {
      id: category._id.toString(),
      name: category.name,
    },
    pricing: {
      tiers: [
        {
          min_qty: 1,
          price: Number(rawProduct.price),
          label: rawProduct.unitLabel || "unidad",
        },
      ],
    },
    box_items: [],
    stock: 25,
    is_active: true,
    cibox_plus: {
      enabled: false,
    },
    sku: rawProduct.sku || "",
    brand: rawProduct.brand || "",
    weight: {
      value: Math.round(Number(rawProduct.weightKg || 0) * 1000),
      unit: "g",
    },
    dimensions: {
      length: Number(rawProduct.length || 0),
      width: Number(rawProduct.width || 0),
      height: Number(rawProduct.height || 0),
      unit: "cm",
    },
  };

  const product = await Product.findOneAndUpdate(
    {
      name: rawProduct.name,
      "vendor.id": vendorData.id,
    },
    payload,
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    },
  );

  return product;
};

/**
 * Sembrado de productos. Asume conexión a Mongo abierta y vendor aprobado.
 * NO se invoca automáticamente al importar.
 */
export const seedProducts = async () => {
  const vendorData = await findApprovedVendor();
  logger.info({ vendor: vendorData }, "seed.products.vendor_resolved");

  let ok = 0;
  let failed = 0;

  for (const item of products) {
    try {
      const product = await upsertProduct(item, vendorData);
      logger.debug({ name: product.name }, "seed.products.upsert_ok");
      ok += 1;
    } catch (err) {
      logger.error(
        { err: { message: err.message }, name: item.name },
        "seed.products.upsert_failed",
      );
      failed += 1;
    }
  }

  logger.info(
    { ok, failed, total: products.length },
    "seed.products.completed",
  );
  return { ok, failed, total: products.length };
};

export default seedProducts;
