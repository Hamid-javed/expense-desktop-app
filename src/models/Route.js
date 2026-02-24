import mongoose from "mongoose";
import { isMongoDB } from "../lib/db/index.js";
import { RouteModel as SQLiteRouteModel } from "./sqlite/Route.js";

const RouteSchemaDef = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    assignedSaleman: { type: mongoose.Schema.Types.ObjectId, ref: "Saleman" },
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

