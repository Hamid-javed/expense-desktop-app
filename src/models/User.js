import mongoose from "mongoose";
import { ROLES } from "../lib/config.js";
import { isMongoDB } from "../lib/db/index.js";
import { User as SQLiteUser } from "./sqlite/User.js";

const UserSchemaDef = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true },
    name: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.ADMIN,
    },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const MongooseUser =
  mongoose.models.User || mongoose.model("User", UserSchemaDef);

export const User = isMongoDB() ? MongooseUser : SQLiteUser;

