import mongoose from "mongoose";

const couponUsageSchema = new mongoose.Schema(
  {
    coupon_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    guest_id: {
      type: String,
      default: null,
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    discount_amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

couponUsageSchema.index({ coupon_id: 1, user_id: 1 });
couponUsageSchema.index({ coupon_id: 1, order_id: 1 }, { unique: true });
couponUsageSchema.index({ order_id: 1 });

export const CouponUsage =
  mongoose.models.CouponUsage ||
  mongoose.model("CouponUsage", couponUsageSchema);
export default CouponUsage;
