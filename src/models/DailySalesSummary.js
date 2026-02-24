import mongoose from "mongoose";
import { isMongoDB } from "../lib/db/index.js";
import { DailySalesSummary as SQLiteDailySalesSummary } from "./sqlite/DailySalesSummary.js";

const DailySalesSummarySchemaDef = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    salemanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Saleman",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    cashSales: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    creditSales: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Compound index to ensure one saleman per date
DailySalesSummarySchemaDef.index({ salemanId: 1, date: 1 }, { unique: true });

const MongooseDailySalesSummary =
  mongoose.models.DailySalesSummary ||
  mongoose.model("DailySalesSummary", DailySalesSummarySchemaDef);

export const DailySalesSummary = isMongoDB() ? MongooseDailySalesSummary : SQLiteDailySalesSummary;
