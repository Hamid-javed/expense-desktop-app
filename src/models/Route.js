import mongoose from "mongoose";
import { isMongoDB } from "../lib/db/index.js";
import { RouteModel as SQLiteRouteModel } from "./sqlite/Route.js";

const RouteSchemaDef = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
    // Shops are linked from Shop.routeId; we keep this field for quick reverse lookups if needed
    shopIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Shop" }],
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const MongooseRouteModel =
  mongoose.models.Route || mongoose.model("Route", RouteSchemaDef);

export const RouteModel = isMongoDB() ? MongooseRouteModel : SQLiteRouteModel;

