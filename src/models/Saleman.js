import mongoose from "mongoose";
import { isMongoDB } from "../lib/db/index.js";
import { Saleman as SQLiteSaleman } from "./sqlite/Saleman.js";

const SalemanSchemaDef = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    cnic: { type: String, trim: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: "Route" },
    salemanId: { type: String, index: true }, // 6-digit generated, unique per user
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

SalemanSchemaDef.index({ userId: 1, salemanId: 1 }, { unique: true, sparse: true });

const MongooseSaleman =
  mongoose.models.Saleman || mongoose.model("Saleman", SalemanSchemaDef);

export const Saleman = isMongoDB() ? MongooseSaleman : SQLiteSaleman;

