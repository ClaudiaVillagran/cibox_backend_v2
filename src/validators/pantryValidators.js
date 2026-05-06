import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "ID inválido");

export const addPantryItemSchema = z.object({
  productId: objectIdSchema,
  quantity: z.number().int().min(1).max(999).optional(),
  auto_reorder: z.boolean().optional(),
  frequency_days: z.number().int().min(1).max(365).optional(),
});

export const updatePantryItemSchema = z
  .object({
    quantity: z.number().int().min(1).max(999).optional(),
    auto_reorder: z.boolean().optional(),
    frequency_days: z.number().int().min(1).max(365).optional(),
    last_purchased_at: z.string().datetime().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debes enviar al menos un campo a actualizar",
  });

export const pantryItemParamsSchema = z.object({
  productId: objectIdSchema,
});

export const checkoutPantrySchema = z.object({
  shipping: z.object({
    region: z.string().trim().min(1),
    city: z.string().trim().min(1),
    address: z.string().trim().min(1),
    addressLine2: z.string().trim().optional().nullable(),
    reference: z.string().trim().optional().nullable(),
  }),
  platform: z.enum(["ios", "android", "web", "native"]).optional(),
});
