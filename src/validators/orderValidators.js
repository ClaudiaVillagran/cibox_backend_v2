import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "ID inválido");

const customerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(8).max(20),
  rut: z.string().min(7).max(15),
});

const shippingSchema = z.object({
  region: z.string().min(2).max(80),
  city: z.string().min(2).max(80),
  address: z.string().min(5).max(200),
  addressLine2: z.string().max(120).optional().nullable(),
  reference: z.string().max(200).optional().nullable(),
});

const paymentSchema = z
  .object({
    method: z.enum(["webpay"]).optional(),
    platform: z.enum(["ios", "android", "web", "native"]).optional(),
  })
  .optional();

export const createFromCartSchema = {
  body: z.object({
    customer: customerSchema,
    shipping: shippingSchema,
    payment: paymentSchema,
    notes: z.string().max(500).optional().nullable(),
    couponCode: z.string().min(2).max(40).optional().nullable(),
  }),
};

const customBoxItemSchema = z.object({
  product_id: objectId,
  quantity: z.coerce.number().int().min(1).max(999),
});

export const createFromCustomBoxSchema = {
  body: z.object({
    items: z.array(customBoxItemSchema).min(1).max(50),
    customer: customerSchema,
    shipping: shippingSchema,
    payment: paymentSchema,
    notes: z.string().max(500).optional().nullable(),
    couponCode: z.string().min(2).max(40).optional().nullable(),
  }),
};

export const cancelOrderSchema = {
  params: z.object({ id: objectId }),
  body: z
    .object({
      reason: z.string().max(300).optional().nullable(),
      guestToken: z.string().min(32).max(128).optional().nullable(),
    })
    .optional(),
};

export const orderIdParamSchema = {
  params: z.object({ id: objectId }),
};

export const guestOrderLookupSchema = {
  params: z.object({ id: objectId }),
  query: z.object({
    token: z.string().min(32).max(128),
  }),
};

export const retryPaymentSchema = {
  params: z.object({ id: objectId }),
  body: z
    .object({
      platform: z.enum(["ios", "android", "web", "native"]).optional(),
      guestToken: z.string().min(32).max(128).optional().nullable(),
    })
    .optional(),
};
