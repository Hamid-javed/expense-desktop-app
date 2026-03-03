import bcrypt from "bcryptjs";
import { connectToDatabase, isMongoDB } from "../src/lib/db/index.js";
import { Product } from "../src/models/Product.js";
import { Saleman } from "../src/models/Saleman.js";
import { Shop } from "../src/models/Shop.js";
import { RouteModel } from "../src/models/Route.js";
import { User } from "../src/models/User.js";
import { InvoiceCounter } from "../src/models/InvoiceCounter.js";
import { Sale } from "../src/models/Sale.js";
import { DailySalesSummary } from "../src/models/DailySalesSummary.js";
import { CreditPayment } from "../src/models/CreditPayment.js";
import { ReturnModel } from "../src/models/Return.js";
import { Expense } from "../src/models/Expense.js";
import { Purchase } from "../src/models/Purchase.js";
import { SalemanPayment } from "../src/models/SalemanPayment.js";
import { OrderTaker } from "../src/models/OrderTaker.js";
import mongoose from "mongoose";

const DEFAULT_ADMIN_PASSWORD = "alrazaqtraders";
// const DEFAULT_ADMIN_PASSWORD = "Wao@123";

const USER_ONLY = process.argv.includes("--user-only") || process.argv.includes("--only-user");
const CLEAR_FIRST = process.argv.includes("--clear") || process.argv.includes("--delete");
const DEMO_DATA = process.argv.includes("--demo") || process.argv.includes("--with-demo");

// Helper to get ID (handles both MongoDB _id and SQLite id)
function getId(obj) {
  return obj._id || obj.id;
}

function getIdString(obj) {
  const id = getId(obj);
  return id?.toString ? id.toString() : String(id);
}

async function clearData() {
  await connectToDatabase();
  console.log("Clearing existing data...");
  await Promise.all([
    Product.deleteMany({}),
    Saleman.deleteMany({}),
    Shop.deleteMany({}),
    RouteModel.deleteMany({}),
    User.deleteMany({}),
    Sale.deleteMany({}),
    DailySalesSummary.deleteMany({}),
    CreditPayment.deleteMany({}),
    ReturnModel.deleteMany({}),
    Expense.deleteMany({}),
    Purchase.deleteMany({}),
    SalemanPayment.deleteMany({}),
    OrderTaker.deleteMany({}),
    InvoiceCounter.deleteMany({}),
  ]);
  console.log("Data cleared.");
}

async function seedUserOnly() {
  await connectToDatabase();

  const dbType = isMongoDB() ? "MongoDB" : "SQLite";
  console.log(`Creating admin user in ${dbType}...`);

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
  const admin = await User.findOneAndUpdate(
    { email: "admin@alrazaqtraders.com" },
    { email: "admin@alrazaqtraders.com", name: "Al Razaq Traders", passwordHash },
    { upsert: true, new: true }
  );

  console.log("User created/updated.");
  console.log({ admin: { email: admin.email, password: DEFAULT_ADMIN_PASSWORD } });

  if (isMongoDB()) {
    await mongoose.disconnect();
  }
}

async function main() {
  if (USER_ONLY) {
    if (CLEAR_FIRST) {
      await connectToDatabase();
      await User.deleteMany({});
      console.log("Users cleared.");
    }
    return seedUserOnly();
  }

  if (CLEAR_FIRST) {
    await clearData();
  }

  await connectToDatabase();

  const dbType = isMongoDB() ? "MongoDB" : "SQLite";
  console.log(
    DEMO_DATA
      ? `Seeding ${dbType} database with demo/demo data...`
      : `Running ${dbType} migrations and admin/invoice setup (no demo data)...`
  );

  // Fix legacy MongoDB index on invoicecounters (drop unique { key: 1 } index if it exists)
  if (isMongoDB()) {
    try {
      const indexes = await InvoiceCounter.collection.indexes();
      const keyOnlyIndex = indexes.find(
        (idx) =>
          idx.name === "key_1" ||
          (idx.key && idx.key.key === 1 && !idx.key.userId)
      );

      if (keyOnlyIndex) {
        console.log('Dropping legacy "key_1" index from invoicecounters...');
        await InvoiceCounter.collection.dropIndex(keyOnlyIndex.name);
      }
    } catch (err) {
      console.warn("Unable to inspect/drop legacy invoicecounters index:", err.message || err);
    }
  }

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
  const admin = await User.findOneAndUpdate(
    { email: "hamid@gmail.com" },
    { email: "hamid@gmail.com", name: "Hamid Traders", passwordHash },
    { upsert: true, new: true }
  );

  const adminId = getId(admin);
  const adminIdStr = getIdString(admin);

  // By default we DO NOT seed demo data (products, salesmen, shops, etc.)
  // To seed demo data, run with --demo or --with-demo
  let routes = [];
  let salesmen = [];
  let shops = [];
  let products = [];

  if (DEMO_DATA) {
    routes = await RouteModel.insertMany(
      isMongoDB()
        ? [
          { userId: adminId, name: "Route A" },
          { userId: adminId, name: "Route B" },
        ]
        : [
          { name: "Route A" },
          { name: "Route B" },
        ]
    );

    salesmen = await Saleman.insertMany(
      isMongoDB()
        ? [
          {
            userId: adminId,
            name: "John Doe",
            phone: "111-111-1111",
            routeId: getId(routes[0]),
            salemanId: "100001",
          },
          {
            userId: adminId,
            name: "Jane Smith",
            phone: "222-222-2222",
            routeId: getId(routes[1]),
            salemanId: "100002",
          },
        ]
        : [
          {
            name: "John Doe",
            phone: "111-111-1111",
            routeId: getId(routes[0]),
            salemanId: "100001",
          },
          {
            name: "Jane Smith",
            phone: "222-222-2222",
            routeId: getId(routes[1]),
            salemanId: "100002",
          },
        ]
    );

    shops = await Shop.insertMany(
      isMongoDB()
        ? [
          {
            userId: adminId,
            name: "Alpha Store",
            phone: "555-0001",
            currentCredit: 0,
            routeId: getId(routes[0]),
          },
          {
            userId: adminId,
            name: "Beta Market",
            phone: "555-0002",
            currentCredit: 0,
            routeId: getId(routes[1]),
          },
        ]
        : [
          {
            name: "Alpha Store",
            phone: "555-0001",
            currentCredit: 0,
            routeId: getId(routes[0]),
          },
          {
            name: "Beta Market",
            phone: "555-0002",
            currentCredit: 0,
            routeId: getId(routes[1]),
          },
        ]
    );

    products = await Product.insertMany(
      isMongoDB()
        ? [
          { userId: adminId, name: "Product A", sku: "PA-001", unit: "pcs", price: 10 },
          { userId: adminId, name: "Product B", sku: "PB-001", unit: "box", price: 25 },
          { userId: adminId, name: "Product C", sku: "PC-001", unit: "kg", price: 5 },
        ]
        : [
          { name: "Product A", sku: "PA-001", unit: "pcs", price: 10 },
          { name: "Product B", sku: "PB-001", unit: "box", price: 25 },
          { name: "Product C", sku: "PC-001", unit: "kg", price: 5 },
        ]
    );
  }

  if (isMongoDB()) {
    await InvoiceCounter.findOneAndUpdate(
      { userId: adminId, key: "invoice" },
      { $setOnInsert: { userId: adminId, key: "invoice", lastNumber: 0 } },
      { upsert: true }
    );
  } else {
    await InvoiceCounter.findOneAndUpdate(
      { key: "invoice" },
      { $setOnInsert: { key: "invoice", lastNumber: 0 } },
      { upsert: true }
    );
  }

  console.log("Seed complete.");
  console.log({
    admin: { email: admin.email, password: DEFAULT_ADMIN_PASSWORD },
    routes: routes.map((r) => ({ id: getIdString(r), name: r.name })),
    salesmen: salesmen.map((s) => ({ id: getIdString(s), name: s.name })),
    shops: shops.map((s) => ({ id: getIdString(s), name: s.name })),
    products: products.map((p) => ({ id: getIdString(p), name: p.name })),
  });

  // Disconnect MongoDB if used
  if (isMongoDB()) {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

