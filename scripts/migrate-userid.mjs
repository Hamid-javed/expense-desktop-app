/**
 * Migration: Add userId to existing MongoDB documents that lack it.
 * Run this if you have data created before multi-tenant support.
 * Usage: node --env-file=.env scripts/migrate-userid.mjs
 */
import { connectToDatabase, isMongoDB } from "../src/lib/db/index.js";
import { User } from "../src/models/User.js";
import { Sale } from "../src/models/Sale.js";
import { Shop } from "../src/models/Shop.js";
import { Staff } from "../src/models/Staff.js";
import { Product } from "../src/models/Product.js";
import { RouteModel } from "../src/models/Route.js";
import { OrderTaker } from "../src/models/OrderTaker.js";
import mongoose from "mongoose";

async function main() {
  if (!isMongoDB()) {
    console.log("This migration is for MongoDB only. Skipping.");
    return;
  }

  await connectToDatabase();

  const user = await User.findOne({ deletedAt: null }).lean();
  if (!user) {
    console.error("No user found. Create a user first.");
    process.exit(1);
  }

  const userId = user._id;

  const models = [
    { name: "Sale", Model: Sale },
    { name: "Shop", Model: Shop },
    { name: "Staff", Model: Staff },
    { name: "Product", Model: Product },
    { name: "Route", Model: RouteModel },
    { name: "OrderTaker", Model: OrderTaker },
  ];

  for (const { name, Model } of models) {
    const result = await Model.updateMany(
      { $or: [{ userId: null }, { userId: { $exists: false } }] },
      { $set: { userId } }
    );
    if (result.modifiedCount > 0) {
      console.log(`${name}: updated ${result.modifiedCount} documents with userId`);
    }
  }

  await mongoose.disconnect();
  console.log("Migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
