import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

export const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    logger.info({ uri: env.MONGO_URI.replace(/\/\/.*@/, "//***@") }, "Mongo conectado");
  } catch (err) {
    logger.fatal({ err: err.message }, "No se pudo conectar a Mongo");
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => logger.warn("Mongo desconectado"));
  mongoose.connection.on("reconnected", () => logger.info("Mongo reconectado"));
  mongoose.connection.on("error", (err) => logger.error({ err }, "Mongo error"));
};
