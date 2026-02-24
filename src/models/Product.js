import mongoose from "mongoose";
import { UNITS } from "../lib/config.js";
import { isMongoDB } from "../lib/db/index.js";
import { Product as SQLiteProduct } from "./sqlite/Product.js";

const ProductSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    unit: { type: String, enum: UNITS, default: "pcs" },
    buyPrice: { type: Number, required: true, default: 0, min: 0 },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: 0, min: 0 }, // Current stock on hand
    isActive: { type: Boolean, default: true },
    // Aggregated fields (denormalized for fast dashboard/reporting)
    totalBought: { type: Number, default: 0 },
    totalSold: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Unique per user (multi-tenant)
ProductSchema.index({ userId: 1, sku: 1 }, { unique: true });

const MongooseProduct =
  mongoose.models.Product || mongoose.model("Product", ProductSchema);

// Export the appropriate model based on database type
export const Product = isMongoDB() ? MongooseProduct : SQLiteProduct;

