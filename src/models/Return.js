import mongoose from "mongoose";
import { isMongoDB } from "../lib/db/index.js";
import { ReturnModel as SQLiteReturnModel } from "./sqlite/Return.js";

const ReturnSchemaDef = new mongoose.Schema(
  {
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const MongooseReturnModel =
  mongoose.models.Return || mongoose.model("Return", ReturnSchemaDef);

export const ReturnModel = isMongoDB() ? MongooseReturnModel : SQLiteReturnModel;

