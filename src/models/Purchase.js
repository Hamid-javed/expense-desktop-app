import mongoose from "mongoose";
import { isMongoDB } from "../lib/db/index.js";
import { Purchase as SQLitePurchase } from "./sqlite/Purchase.js";

const PurchaseSchemaDef = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true, min: 0 },
        buyPrice: { type: Number, required: true, min: 0 },
        totalAmount: { type: Number, required: true },
        date: { type: Date, required: true, index: true },
        supplier: { type: String, trim: true },
        isActive: { type: Boolean, default: true },
        deletedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

const MongoosePurchase = mongoose.models.Purchase || mongoose.model("Purchase", PurchaseSchemaDef);

export const Purchase = isMongoDB() ? MongoosePurchase : SQLitePurchase;
