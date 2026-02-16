import mongoose from "mongoose";
import { isMongoDB } from "../lib/db/index.js";
import { InvoiceCounter as SQLiteInvoiceCounter } from "./sqlite/InvoiceCounter.js";

const InvoiceCounterSchemaDef = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    lastNumber: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const MongooseInvoiceCounter =
  mongoose.models.InvoiceCounter ||
  mongoose.model("InvoiceCounter", InvoiceCounterSchemaDef);

export const InvoiceCounter = isMongoDB() ? MongooseInvoiceCounter : SQLiteInvoiceCounter;

