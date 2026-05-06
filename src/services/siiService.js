import crypto from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { TaxDocument } from "../models/TaxDocument.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";

const computeIvaBreakdown = (total) => {
  const t = Number(total || 0);
  const neto = Math.round(t / 1.19);
  const iva = t - neto;
  return { neto, iva };
};

const buildStubFolio = () => {
  const ts = Date.now().toString(36);
  const rnd = crypto.randomBytes(3).toString("hex");
  return `STUB-${ts}-${rnd}`.toUpperCase();
};

const isValidType = (type) => type === "boleta" || type === "factura";

export const emitDocumentForOrder = async (order, type = "boleta") => {
  if (!order || !order._id) throw new BadRequestError("Orden inválida");
  if (!isValidType(type))
    throw new BadRequestError(`Tipo de documento inválido: ${type}`);

  // Idempotencia: si ya existe documento aceptado para esta orden y tipo, retornarlo
  const existing = await TaxDocument.findOne({
    order_id: order._id,
    type,
    status: { $in: ["pending", "accepted"] },
  }).lean();
  if (existing) return existing;

  const total = Number(order.total || 0);
  const { neto, iva } = computeIvaBreakdown(total);

  if (!env.SII_ENABLED) {
    logger.warn(
      { order_id: String(order._id), type, sii_enabled: false },
      "sii.emit.stub",
    );

    const folio = buildStubFolio();
    const doc = await TaxDocument.create({
      order_id: order._id,
      type,
      folio,
      rut_receptor: order.customer?.rut || "",
      razon_social: order.customer?.fullName || "",
      total,
      neto,
      iva,
      xml_url: null,
      pdf_url: null,
      sii_track_id: `stub-${folio}`,
      status: "accepted",
      stub: true,
      emitted_at: new Date(),
    });

    return {
      ...doc.toObject(),
      stub: true,
    };
  }

  // TODO: integración real con proveedor SII (openfactura, dteservice, etc.)
  // Estructura preparada para cuando se habilite:
  // 1. Construir XML del DTE según schema SII
  // 2. Firmar con certificado (env.SII_CERT_PATH / env.SII_CERT_PASSWORD)
  // 3. Enviar a SII / proveedor
  // 4. Esperar TrackId y consultar estado
  // 5. Generar PDF
  // 6. Guardar URLs y folio definitivo
  logger.error(
    { order_id: String(order._id), type },
    "sii.emit.real_integration_not_implemented",
  );

  const doc = await TaxDocument.create({
    order_id: order._id,
    type,
    folio: null,
    rut_receptor: order.billing?.rut || "",
    razon_social:
      order.billing?.razon_social || order.shipping?.full_name || "",
    total,
    neto,
    iva,
    status: "pending",
    stub: false,
    emitted_at: new Date(),
  });
  return doc.toObject();
};

export const voidDocument = async (folio) => {
  if (!folio) throw new BadRequestError("Folio requerido");
  const doc = await TaxDocument.findOne({ folio });
  if (!doc) throw new NotFoundError("Documento no encontrado");

  if (doc.status === "voided") return doc.toObject();

  if (!env.SII_ENABLED) {
    logger.warn({ folio, stub: true }, "sii.void.stub");
    doc.status = "voided";
    await doc.save();
    return { ...doc.toObject(), stub: true };
  }

  // TODO: anulación real ante SII / proveedor
  logger.error({ folio }, "sii.void.real_integration_not_implemented");
  doc.status = "voided";
  await doc.save();
  return doc.toObject();
};
