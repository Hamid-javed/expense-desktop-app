import mongoose from "mongoose";
import { isMongoDB } from "../lib/db/index.js";
import { OrderTaker as SQLiteOrderTaker } from "./sqlite/OrderTaker.js";

const OrderTakerSchemaDef = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    number: { type: String, required: true, trim: true },
    cnic: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const MongooseOrderTaker =
  mongoose.models.OrderTaker ||
  mongoose.model("OrderTaker", OrderTakerSchemaDef);

export const OrderTaker = isMongoDB() ? MongooseOrderTaker : SQLiteOrderTaker;
