import { connectToDatabase, isMongoDB } from "../src/lib/db/index.js";
import { User } from "../src/models/User.js";
import { Sale } from "../src/models/Sale.js";
import { Expense } from "../src/models/Expense.js";
import { Purchase } from "../src/models/Purchase.js";
import { Shop } from "../src/models/Shop.js";
import { RouteModel } from "../src/models/Route.js";
import { Saleman } from "../src/models/Saleman.js";
import { CreditPayment } from "../src/models/CreditPayment.js";
import { SalemanPayment } from "../src/models/SalemanPayment.js";
import { ReturnModel } from "../src/models/Return.js";
import { DailySalesSummary } from "../src/models/DailySalesSummary.js";
import { InvoiceCounter } from "../src/models/InvoiceCounter.js";
import { Product } from "../src/models/Product.js";
import mongoose from "mongoose";

/**
 * One-time migration helper to fix/normalize userId ownership
 * for MongoDB deployments.
 *
 * Usage examples:
 *   node --env-file=.env scripts/migrate-user-data.mjs --dry-run
 *   node --env-file=.env scripts/migrate-user-data.mjs --from=<oldUserId> --to=<newUserId>
 *
 * This script is intentionally conservative:
 * - It only runs in MongoDB mode.
 * - By default it runs in dry-run mode and prints what it would change.
 * - You must explicitly pass --from and --to to actually reassign data.
 */

const COLLECTIONS_WITH_USER = [
  { name: "Sale", model: Sale },
  { name: "Expense", model: Expense },
  { name: "Purchase", model: Purchase },
  { name: "Shop", model: Shop },
  { name: "Route", model: RouteModel },
  { name: "Saleman", model: Saleman },
  { name: "CreditPayment", model: CreditPayment },
  { name: "SalemanPayment", model: SalemanPayment },
  { name: "Return", model: ReturnModel },
  { name: "DailySalesSummary", model: DailySalesSummary },
  { name: "InvoiceCounter", model: InvoiceCounter },
  { name: "Product", model: Product },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    dryRun: true,
    from: null,
    to: null,
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      opts.dryRun = true;
    } else if (arg === "--apply") {
      opts.dryRun = false;
    } else if (arg.startsWith("--from=")) {
      opts.from = arg.split("=")[1];
    } else if (arg.startsWith("--to=")) {
      opts.to = arg.split("=")[1];
    }
  }

  return opts;
}

async function listUsersAndCounts() {
  const users = await User.find({ deletedAt: null }).lean();
  console.log("Existing users:");
  for (const u of users) {
    console.log(` - ${u._id.toString()} | ${u.email} | active=${u.isActive}`);
  }

  console.log("\nRecord counts per userId (by collection):");
  for (const { name, model } of COLLECTIONS_WITH_USER) {
    const pipeline = [
      { $group: { _id: "$userId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ];
    const agg = await model.aggregate(pipeline);
    console.log(`\n${name}:`);
    if (agg.length === 0) {
      console.log("  (no documents)");
      continue;
    }
    for (const row of agg) {
      const uid = row._id ? row._id.toString() : "(null)";
      console.log(`  userId=${uid} -> ${row.count} docs`);
    }
  }
}

async function reassignUserData(fromId, toId, dryRun) {
  if (!fromId || !toId) {
    throw new Error("Both --from and --to must be provided to reassign data.");
  }
  if (fromId === toId) {
    console.log("from and to userId are identical; nothing to do.");
    return;
  }

  const fromObjectId = new mongoose.Types.ObjectId(fromId);
  const toObjectId = new mongoose.Types.ObjectId(toId);

  console.log(
    `${dryRun ? "[DRY-RUN]" : "[APPLY]"} Reassigning data from userId=${fromId} -> ${toId}`
  );

  for (const { name, model } of COLLECTIONS_WITH_USER) {
    const filter = { userId: fromObjectId };
    const count = await model.countDocuments(filter);
    if (!count) {
      console.log(` - ${name}: 0 docs to move`);
      continue;
    }
    if (dryRun) {
      console.log(` - ${name}: would update ${count} docs`);
    } else {
      const res = await model.updateMany(filter, { $set: { userId: toObjectId } });
      console.log(
        ` - ${name}: matched=${res.matchedCount ?? res.n} modified=${res.modifiedCount ?? res.nModified}`
      );
    }
  }
}

async function main() {
  const opts = parseArgs();

  await connectToDatabase();

  if (!isMongoDB()) {
    console.error("This migration script only applies to MongoDB deployments.");
    process.exit(1);
  }

  console.log("Connected to MongoDB.");

  // Always show current user and per-collection counts first
  await listUsersAndCounts();

  if (!opts.from || !opts.to) {
    console.log(
      "\nNo --from/--to specified. Run again with:\n" +
      "  node --env-file=.env scripts/migrate-user-data.mjs --from=<oldUserId> --to=<newUserId> [--apply]\n" +
      "By default this script runs in DRY-RUN mode."
    );
  } else {
    await reassignUserData(opts.from, opts.to, opts.dryRun);
    if (opts.dryRun) {
      console.log(
        "\nDry-run complete. If the above summary looks correct, re-run with --apply to persist the changes."
      );
    } else {
      console.log("\nReassignment complete.");
    }
  }

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});

