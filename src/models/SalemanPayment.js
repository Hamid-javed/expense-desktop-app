import mongoose from "mongoose";
import { isMongoDB } from "../lib/db/index.js";
import { SalemanPayment as SQLiteSalemanPayment } from "./sqlite/SalemanPayment.js";

const SalemanPaymentSchemaDef = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        salemanId: { type: mongoose.Schema.Types.ObjectId, ref: "Saleman", required: true, index: true },
        amount: { type: Number, required: true, min: 0 },
        date: { type: Date, required: true, index: true },
        type: { type: String, enum: ["Salary", "Advance"], required: true },
        month: { type: String, required: true }, // Format "YYYY-MM"
        description: { type: String, trim: true },
        isActive: { type: Boolean, default: true },
        deletedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

const MongooseSalemanPayment = mongoose.models.SalemanPayment || mongoose.model("SalemanPayment", SalemanPaymentSchemaDef);

export const SalemanPayment = isMongoDB() ? MongooseSalemanPayment : SQLiteSalemanPayment;
