import mongoose from "mongoose";
import { isMongoDB } from "../lib/db/index.js";
import { Staff as SQLiteStaff } from "./sqlite/Staff.js";

const StaffSchemaDef = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    cnic: { type: String, trim: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: "Route" },
    staffId: { type: String, index: true }, // 6-digit generated, unique per user
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

StaffSchemaDef.index({ userId: 1, staffId: 1 }, { unique: true, sparse: true });

const MongooseStaff =
  mongoose.models.Staff || mongoose.model("Staff", StaffSchemaDef);

export const Staff = isMongoDB() ? MongooseStaff : SQLiteStaff;

