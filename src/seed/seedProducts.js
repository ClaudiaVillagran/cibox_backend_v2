import { Product } from "../models/Product.js";
import { Vendor } from "../models/Vendor.js";
import { Category } from "../models/Category.js";
import { normalizeText } from "../utils/normalizeText.js";
import { logger } from "../utils/logger.js";

const products = [
  {
    name: "YOGHURT BATIFRUT PIÑA SOPROLE 165G",
    price: 797,
    categoryPath: "Despensa > Postres",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/YOGHURT-BATIFRUT-PINA-SOPROLE-165G.jpg"],
    brand: "Soprole",
    weightKg: 0.165,
    length: 20,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "YOGHURT BATIFRUT TROZOS FRUTILLA SOPROLE 165G",
    price: 797,
    categoryPath: "Despensa > Postres",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/YOGHURT-BATIFRUT-TROZOS-FRUTILLA-SOPROLE-165G.jpg"],
    brand: "Soprole",
    weightKg: 0.165,
    length: 20,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "YOGHURT GOLD FRUTOS SECOS SOPROLE 165G",
    price: 860,
    categoryPath: "Despensa > Postres",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/YOGHURT-GOLD-FRUTOS-SECOS-SOPROLE-165G.jpg"],
    brand: "Soprole",
    weightKg: 0.165,
    length: 20,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "YOGHURT NATURAL QUILLAYES 800CC",
    price: 3170,
    categoryPath: "Despensa > Postres",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/YOGHURT-NATURAL-QUILLAYES-800CC.jpg"],
    brand: "QUILLAYES",
    weightKg: 0.8,
    length: 20,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "YOGHURT NATURAL SOPROLE 155G",
    price: 513,
    categoryPath: "Despensa > Postres",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/YOGHURT-NATURAL-SOPROLE-155G.jpg"],
    brand: "Soprole",
    weightKg: 0.155,
    length: 20,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "YOGHURT PROTEIN FRUTILLA SOPROLE 155G",
    price: 797,
    categoryPath: "Despensa > Postres",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/YOGHURT-PROTEIN-FRUTILLA-SOPROLE-155G.jpg"],
    brand: "Soprole",
    weightKg: 0.155,
    length: 20,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "YOGHURT ZEROLACTO FRUTILLA SOPROLE 120G",
    price: 513,
    categoryPath: "Lácteos, Huevos > Lácteos sin lactosa",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/YOGHURT-ZEROLACTO-FRUTILLA-SOPROLE-120G.jpg"],
    brand: "Soprole",
    weightKg: 0.12,
    length: 20,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "YOGHURT ZEROLACTO FRUTOS SECOS SOPROLE 155 G",
    price: 744,
    categoryPath: "Lácteos, Huevos > Lácteos sin lactosa",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/155G.png"],
    brand: "Soprole",
    weightKg: 1,
    length: 20,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "ZANAHORIA K",
    price: 1283,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/ZANAHORIA-K.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "ZAPALLO ITALIANO U",
    price: 780,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/ChatGPT-Image-23-feb-2026-10_48_06-a.m.png"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "DURAZNO CUBITOS WASIL 500G",
    price: 1896,
    categoryPath: "Despensa > Conservas",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/DURAZNO-CUBITOS-WASIL-500G.webp"],
    brand: "WASIL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Lechuga Costina (c/u)",
    price: 1560,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/lechuga-c.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Lechuga Escarola (c/u)",
    price: 1560,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Lechuga-Escarola-cu.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Lechuga Española (c/u)",
    price: 1560,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/lechuga-espa.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Tomate Mediano (kg)",
    price: 1800,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/TOMATE-K.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Pepinos (c/u)",
    price: 840,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/PEPINO.avif"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Zapallo Italiano (c/u)",
    price: 840,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/ZAPALLO-ITALIAN-1.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Zapallo (kg)",
    price: 1800,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Zapallo-kg.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Limones (kg)",
    price: 1920,
    categoryPath: "Frutas y Verduras > Frutas",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Limones.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Limón Sutil (kg)",
    price: 3600,
    categoryPath: "Frutas y Verduras > Frutas",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/LIMON-SUTIL-K.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Limón Pica (kg)",
    price: 3600,
    categoryPath: "Frutas y Verduras > Frutas",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Limon-Pica.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Repollo (c/u)",
    price: 2400,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Repollo.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Repollo Morado (c/u)",
    price: 3000,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/REPOLLO-MORADO-U.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Coliflor (c/u)",
    price: 2400,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Coliflor-1.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Zanahoria (kg)",
    price: 2400,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/bro.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Zanahoria (kg)",
    price: 1200,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Zanahoria-kg.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Cilantro (bolsa 150 gr)",
    price: 960,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/cilantro.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Perejil (bolsa 150 gr)",
    price: 840,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/perejil.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Ajos (c/u)",
    price: 360,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/AJO-CABEZA-U.avif"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Cebolla Blanca (kg)",
    price: 1560,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Cebolla-Blanca-1.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Cebolla Morada (kg)",
    price: 1800,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Cebolla-mroa.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Cebollín (Paquete)",
    price: 1200,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Cebollin-Paquete.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Ajies Verdes (c/u)",
    price: 240,
    categoryPath: "Despensa > Ajíes",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Ajies-Verdes-1-scaled.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Pimentones (c/u)",
    price: 840,
    categoryPath: "Frutas y Verduras > Frutas",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/Pimentones-cu-1.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Paltas (kg)",
    price: 5400,
    categoryPath: "Frutas y Verduras > Frutas",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Paltas.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Acelgas (Paquete 200 grs)",
    price: 1200,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Acelgas-Paquete-200-grs.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Espinaca (Bolsa 200 grs)",
    price: 1200,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Espinaca.jpeg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Apio (c/u)",
    price: 1800,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Apio-cu.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Rabanitos (Paquete)",
    price: 1440,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Rabanitos-1.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Champiñones (bandeja laminados)",
    price: 2160,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/champ.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Chapsui (bandeja)",
    price: 2160,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Chapsui.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Papas (kg)",
    price: 1200,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/PAPAS-K.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Poroto Verde (Kg)",
    price: 3000,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/SEMILLAS.jpeg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Choclo Humero (c/u)",
    price: 840,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Choclo-Humero.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Choclo Americano (c/u)",
    price: 840,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Choclo-Americano.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Albahaca (Bolsa 200 grs)",
    price: 1200,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Albahaca-Bolsa-200-grs.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Rocoto (1/2 kg)",
    price: 3000,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/Rocoto.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Jengibre (200 grs)",
    price: 1200,
    categoryPath: "Despensa > Condimentos y especias",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/Jengibre-200-grs.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Aji Amarillo (1/2 Kg)",
    price: 2400,
    categoryPath: "Despensa > Ajíes",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Aji-Amarillo-1.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Camote (1 KG)",
    price: 3000,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/camote.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Tomate Cherry (Kg)",
    price: 4200,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/Tomate-Cherry-Kg.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Rúcula (Paquete 200 grs)",
    price: 1200,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/Rucula-Paquete-200-grs.webp"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Betarraga (Paquete)",
    price: 2400,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/BETARRAGA-5-U-1.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Berro (Kg)",
    price: 4200,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/Berro-Kg.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Berenjenas (c/u)",
    price: 840,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/01/Berenjenas-cu.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Ciboulette (Paquete)",
    price: 840,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/Ciboulette-1-1.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Menta (Bolsa 100 grs)",
    price: 1200,
    categoryPath: "Frutas y Verduras > Verduras",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/menta.jpg"],
    brand: "GRANEL",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
    unitLabel: "unidad",
  },
  {
    name: "Miel pura de Ulmo como nunca haz probado",
    price: 9500,
    categoryPath: "Productos artesanales",
    images: ["https://cibox.cl/wp-content/uploads/2026/02/WhatsApp-Image-2026-02-20-at-9.38.16-AM.jpeg"],
    brand: "OTRO",
    weightKg: 1,
    length: 25,
    width: 15,
    height: 10,
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
