import mongoose from "mongoose";

const pricingTierSchema = new mongoose.Schema(
  {
    min_qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    label: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const boxItemSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    vendor: {
      id: {
        type: String,
        required: true,
        index: true,
      },
      name: { type: String, required: true, trim: true },
    },

    product_type: {
      type: String,
      enum: ["simple", "box"],
      default: "simple",
    },

    name: { type: String, required: true, trim: true },
    images: { type: [String], default: [] },
    thumbnail: { type: String, default: "" },

    search_name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    description: { type: String, required: true, trim: true },

    category: {
      id: { type: String, required: true, trim: true },
      name: { type: String, required: true, trim: true },
    },

    pricing: {
      tiers: {
        type: [pricingTierSchema],
        default: [],
        validate: {
          validator: (value) => Array.isArray(value) && value.length > 0,
          message: "El producto debe tener al menos un tier de precio",
        },
      },
      min_price: { type: Number, default: 0, min: 0 },
    },

    box_items: {
      type: [boxItemSchema],
      default: [],
      validate: {
        validator: function (value) {
          if (this.product_type !== "box") return true;
          return Array.isArray(value) && value.length >= 2;
        },
        message: "La caja debe tener al menos 2 productos",
      },
    },

    stock: { type: Number, required: true, default: 0, min: 0 },
    is_active: { type: Boolean, default: true },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },

    cibox_plus: {
      enabled: { type: Boolean, default: false },
    },

    average_rating: { type: Number, default: 0, min: 0, max: 5 },
    reviews_count: { type: Number, default: 0, min: 0 },

    sku: { type: String, trim: true, default: "" },
    brand: { type: String, trim: true, default: "" },

    weight: {
      value: { type: Number, min: 0, default: 0 },
      unit: { type: String, trim: true, default: "g" },
    },

    dimensions: {
      length: { type: Number, min: 0, default: 0 },
      width: { type: Number, min: 0, default: 0 },
      height: { type: Number, min: 0, default: 0 },
      unit: { type: String, trim: true, default: "cm" },
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

productSchema.pre("save", function () {
  if (Array.isArray(this.pricing?.tiers) && this.pricing.tiers.length > 0) {
    const prices = this.pricing.tiers.map((t) => Number(t.price || 0));
    this.pricing.min_price = Math.min(...prices);
  } else {
    this.pricing = this.pricing || {};
    this.pricing.min_price = 0;
  }
});

productSchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate() || {};
  const $set = update.$set || update;

  const tiers = $set?.pricing?.tiers;

  if (Array.isArray(tiers) && tiers.length > 0) {
    const minPrice = Math.min(...tiers.map((t) => Number(t.price || 0)));

    if (update.$set) {
      update.$set["pricing.min_price"] = minPrice;
    } else {
      update["pricing.min_price"] = minPrice;
    }

    this.setUpdate(update);
  }
});

productSchema.index({ is_active: 1, "category.id": 1 });
productSchema.index({ is_active: 1, "vendor.id": 1 });
productSchema.index({ search_name: "text" });
productSchema.index({ is_active: 1, "pricing.min_price": 1 });

export const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);
export default Product;
