import mongoose from "mongoose";
import { isMongoDB } from "../lib/db/index.js";
import { CreditPayment as SQLiteCreditPayment } from "./sqlite/CreditPayment.js";

const CreditPaymentSchemaDef = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    note: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const MongooseCreditPayment =
  mongoose.models.CreditPayment ||
  mongoose.model("CreditPayment", CreditPaymentSchemaDef);

export const CreditPayment = isMongoDB() ? MongooseCreditPayment : SQLiteCreditPayment;

