import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  UPLOAD_DRIVER: z.enum(["disk", "s3", "cloudinary"]).default("disk"),

  CLOUDINARY_CLOUD_NAME: z.string().default(""),
  CLOUDINARY_API_KEY: z.string().default(""),
  CLOUDINARY_API_SECRET: z.string().default(""),
  CLOUDINARY_FOLDER: z.string().default("cibox/products"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),

  MONGO_URI: z.string().min(1, "MONGO_URI requerido"),

  ALLOWED_ORIGINS: z.string().default(""),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET debe tener al menos 32 caracteres"),
  JWT_ACCESS_EXPIRES: z.string().default("30d"),
  JWT_REFRESH_EXPIRES: z.string().default("90d"),

  GUEST_ID_SECRET: z
    .string()
    .min(32, "GUEST_ID_SECRET debe tener al menos 32 caracteres"),

  EMAIL_HOST: z.string().default(""),
  EMAIL_PORT: z.coerce.number().int().positive().default(587),
  EMAIL_USER: z.string().default(""),
  EMAIL_PASS: z.string().default(""),
  EMAIL_FROM: z.string().default("Cibox <no-reply@cibox.cl>"),

  WEBPAY_ENV: z.enum(["integration", "production"]).default("integration"),
  WEBPAY_COMMERCE_CODE: z.string().default(""),
  WEBPAY_API_KEY: z.string().default(""),
  WEBPAY_RETURN_URL: z
    .string()
    .default("http://localhost:3000/api/payments/webpay/return"),

  FRONTEND_URL: z.string().default("http://localhost:5173"),
  MOBILE_DEEP_LINK: z.string().default("myapp://"),

  BLUEEXPRESS_API_URL: z.string().default(""),
  BLUEEXPRESS_API_KEY: z.string().default(""),
  BLUEEXPRESS_ACCOUNT: z.string().default(""),

  SII_ENABLED: z.coerce.boolean().default(false),
  SII_ENV: z.enum(["certification", "production"]).default("certification"),
  SII_RUT_EMPRESA: z.string().default(""),
  SII_CERT_PATH: z.string().default(""),
  SII_CERT_PASSWORD: z.string().default(""),

  UPLOAD_DISK_PATH: z.string().default("./uploads"),
  S3_ACCESS_KEY: z.string().default(""),
  S3_SECRET_KEY: z.string().default(""),
  S3_BUCKET: z.string().default(""),
  S3_REGION: z.string().default("us-east-1"),
  S3_ENDPOINT: z.string().default(""),
  S3_PUBLIC_URL: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variables de entorno inválidas:");
  for (const issue of parsed.error.issues) {
    console.error(` - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const isProd = parsed.data.NODE_ENV === "production";

if (isProd) {
  if (
    parsed.data.WEBPAY_ENV === "production" &&
    (!parsed.data.WEBPAY_COMMERCE_CODE || !parsed.data.WEBPAY_API_KEY)
  ) {
    console.error(
      "❌ WEBPAY_COMMERCE_CODE y WEBPAY_API_KEY son obligatorios en producción",
    );
    process.exit(1);
  }
  if (!parsed.data.ALLOWED_ORIGINS) {
    console.error("❌ ALLOWED_ORIGINS es obligatorio en producción");
    process.exit(1);
  }
}

export const env = {
  ...parsed.data,
  isProd,
  isDev: parsed.data.NODE_ENV === "development",
  isTest: parsed.data.NODE_ENV === "test",
  allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
