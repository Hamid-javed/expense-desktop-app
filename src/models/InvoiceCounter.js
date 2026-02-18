import mongoose from "mongoose";
import { isMongoDB } from "../lib/db/index.js";
import { InvoiceCounter as SQLiteInvoiceCounter } from "./sqlite/InvoiceCounter.js";

const InvoiceCounterSchemaDef = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    key: { type: String, required: true },
    lastNumber: { type: Number, default: 0 },
  },
  { timestamps: true }
);

InvoiceCounterSchemaDef.index({ userId: 1, key: 1 }, { unique: true });

const MongooseInvoiceCounter =
  mongoose.models.InvoiceCounter ||
  mongoose.model("InvoiceCounter", InvoiceCounterSchemaDef);

export const InvoiceCounter = isMongoDB() ? MongooseInvoiceCounter : SQLiteInvoiceCounter;

