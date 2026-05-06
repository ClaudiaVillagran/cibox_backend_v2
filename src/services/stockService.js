import mongoose from "mongoose";
import Product from "../models/Product.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export const decrementStockAtomic = async ({ productId, quantity }, session) => {
  const qty = Number(quantity || 0);

  if (qty <= 0) {
    throw new ConflictError("Cantidad inválida para descontar stock");
  }

  const updated = await Product.collection.findOneAndUpdate(
    {
      _id: productId,
      is_active: true,
      stock: { $gte: qty },
    },
    {
      $inc: { stock: -qty },
    },
    {
      returnDocument: "after",
      session,
    }
  );

  const updatedProduct = updated?.value || updated;

  if (!updatedProduct) {
    const product = await Product.findById(productId)
      .session(session || null)
      .lean();

    if (!product) {
      throw new NotFoundError(`Producto ${productId} no encontrado`);
    }

    if (!product.is_active) {
      throw new ConflictError(`Producto inactivo: ${product.name}`);
    }

    logger.warn(
      { productId, requested: qty, available: product.stock },
      "stock insuficiente al descontar"
    );

    throw new ConflictError(
      `Stock insuficiente para ${product.name} (disponible: ${product.stock}, requerido: ${qty})`
    );
  }

  return updatedProduct;
};
/**
 * Restaura stock (cancelaciones/reembolsos). Idempotente a nivel de cantidad.
 */
export const restoreStock = async ({ productId, quantity }, session) => {
  const qty = Number(quantity || 0);
  if (qty <= 0) return null;

  return Product.findByIdAndUpdate(
    productId,
    { $inc: { stock: qty } },
    { new: true, session }
  );
};

/**
 * Verifica disponibilidad de stock sin descontar (read-only).
 * Útil para validaciones previas a la creación de la orden.
 */
export const checkStockAvailability = async ({ productId, quantity }, session) => {
  const product = await Product.findById(productId)
    .session(session || null)
    .lean();

  if (!product) throw new NotFoundError(`Producto ${productId} no encontrado`);
  if (!product.is_active) throw new ConflictError(`Producto inactivo: ${product.name}`);

  const qty = Number(quantity || 0);
  if (product.stock < qty) {
    throw new ConflictError(
      `Stock insuficiente para ${product.name} (disponible: ${product.stock}, requerido: ${qty})`
    );
  }

  return product;
};
