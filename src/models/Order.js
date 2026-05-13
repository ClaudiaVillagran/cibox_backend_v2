import mongoose from "mongoose";
import { ORDER_STATUS, PAYMENT_STATUS } from "../utils/constants.js";

const orderBoxItemSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, default: "", trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    unit_price: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    box_id: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    original_price: { type: Number, min: 0 },
    tier_label: { type: String, trim: true, default: null },
    discount_applied: { type: Boolean, default: false },
    discount_percent: { type: Number, default: 0, min: 0 },
    discount_amount_per_unit: { type: Number, default: 0, min: 0 },
    discount_source: {
      type: String,
      enum: ["pantry", "cibox_plus", null],
      default: null,
    },
    subtotal: { type: Number, required: true, min: 0 },
    original_subtotal: { type: Number, min: 0 },
    product_type: {
      type: String,
      enum: ["simple", "box"],
      default: "simple",
    },
    box_items: {
      type: [orderBoxItemSchema],
      default: [],
    },
    weight: {
      value: { type: Number, default: 0, min: 0 },
      unit: { type: String, default: "g" },
    },
    dimensions: {
      length: { type: Number, default: 0, min: 0 },
      width: { type: Number, default: 0, min: 0 },
      height: { type: Number, default: 0, min: 0 },
      unit: { type: String, default: "cm" },
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    guest_id: { type: String, default: null },
    guest_token_hash: { type: String, default: null, select: false },
    items: { type: [orderItemSchema], default: [] },
    customer: {
      fullName: { type: String, default: null, trim: true },
      email: { type: String, default: null, trim: true, lowercase: true },
      phone: { type: String, default: null, trim: true },
      rut: { type: String, default: null, trim: true },
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
    },
    source: {
      type: String,
      enum: ["custom_box", "cart", "direct_product", "box"],
      default: "cart",
    },
    payment: {
      method: { type: String, default: "webpay" },
      platform: {
        type: String,
        enum: ["ios", "android", "web", "native"],
        default: "web",
      },
      status: {
        type: String,
        enum: Object.values(PAYMENT_STATUS),
        default: PAYMENT_STATUS.PENDING,
      },
      transaction_id: { type: String, default: null },
      token: { type: String, default: null },
      buy_order: { type: String, default: null },
      session_id: { type: String, default: null },
      amount: { type: Number, default: 0, min: 0 },
      authorization_code: { type: String, default: null },
      response_code: { type: Number, default: null },
      transaction_date: { type: Date, default: null },
      webhook_processed_at: { type: Date, default: null },
    },
    shipping: {
      region: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
      addressLine2: { type: String, default: null, trim: true },
      reference: { type: String, default: null, trim: true },
      amount: { type: Number, default: 0, min: 0 },
      carrier: { type: String, default: "blueexpress_manual" },
      service_name: { type: String, default: null },
      service_code: { type: String, default: null },
      tracking_number: { type: String, default: null },
      shipment_status: { type: String, default: null },
      label_url: { type: String, default: null },
    },
    coupon: {
      code: { type: String, default: null },
      coupon_id: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
      discount_amount: { type: Number, default: 0, min: 0 },
    },
    subtotal: { type: Number, required: true, default: 0, min: 0 },
    shipping_amount: { type: Number, required: true, default: 0, min: 0 },
    discount_amount: { type: Number, required: true, default: 0, min: 0 },
    total: { type: Number, required: true, default: 0, min: 0 },
    notes: { type: String, default: null, trim: true },
    cancelled_at: { type: Date, default: null },
    cancellation_reason: { type: String, default: null, trim: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.guest_token_hash;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret) => {
        delete ret.guest_token_hash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

orderSchema.index({ user_id: 1, created_at: -1 });
orderSchema.index({ guest_id: 1, created_at: -1 });
orderSchema.index({ "payment.token": 1 });
orderSchema.index({ "payment.buy_order": 1 });
orderSchema.index({ "items.product_id": 1 });
orderSchema.index({ status: 1, created_at: -1 });
orderSchema.index({ "items.vendor.id": 1, status: 1, created_at: -1 });
orderSchema.index({ "payment.status": 1, created_at: -1 });

export const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
export default Order;