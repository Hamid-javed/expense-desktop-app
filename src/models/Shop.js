import mongoose from "mongoose";
import { isMongoDB } from "../lib/db/index.js";
import { Shop as SQLiteShop } from "./sqlite/Shop.js";

const ShopSchemaDef = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    ownerName: { type: String, trim: true },
    phone: { type: String, trim: true },
    cnic: { type: String, trim: true },
    currentCredit: { type: Number, default: 0 },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: "Route" },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const MongooseShop =
  mongoose.models.Shop || mongoose.model("Shop", ShopSchemaDef);

export const Shop = isMongoDB() ? MongooseShop : SQLiteShop;

