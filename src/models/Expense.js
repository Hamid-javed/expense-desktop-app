import mongoose from "mongoose";
import { isMongoDB } from "../lib/db/index.js";
import { Expense as SQLiteExpense } from "./sqlite/Expense.js";

const ExpenseSchemaDef = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        category: {
            type: String,
            required: true,
            enum: ["Fuel", "Food", "Salary", "Advance", "Shop Discount", "Other"],
            index: true
        },
        description: { type: String, trim: true },
        amount: { type: Number, required: true, min: 0 },
        date: { type: Date, required: true, index: true },
        salemanId: { type: mongoose.Schema.Types.ObjectId, ref: "Saleman" }, // Optional: link to saleman if it's salary/advance
        isActive: { type: Boolean, default: true },
        deletedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

const MongooseExpense = mongoose.models.Expense || mongoose.model("Expense", ExpenseSchemaDef);

export const Expense = isMongoDB() ? MongooseExpense : SQLiteExpense;
