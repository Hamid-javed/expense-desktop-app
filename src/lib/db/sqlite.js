import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

let dbInstance = null;

/**
 * Initialize SQLite database connection and create schema
 */
export function connectSQLite(dbPath) {
  if (dbInstance) {
    return dbInstance;
  }

  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(dbPath);
  dbInstance.pragma("journal_mode = WAL"); // Enable WAL mode for better concurrency

  // Initialize schema
  initializeSchema(dbInstance);

  return dbInstance;
}

/**
 * Initialize database schema - creates all tables
 */
function initializeSchema(db) {
  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  // Products table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      unit TEXT DEFAULT 'pcs',
      price REAL NOT NULL DEFAULT 0,
      buyPrice REAL NOT NULL DEFAULT 0,
      quantity REAL DEFAULT 0,
      totalBought REAL DEFAULT 0,
      totalSold REAL DEFAULT 0,
      totalRevenue REAL DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deletedAt);
  `);

  // Routes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      assignedSaleman INTEGER,
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      FOREIGN KEY (assignedSaleman) REFERENCES saleman(id)
    );
    CREATE INDEX IF NOT EXISTS idx_routes_deleted ON routes(deletedAt);
  `);

  // Saleman table
  db.exec(`
    CREATE TABLE IF NOT EXISTS saleman (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      cnic TEXT,
      routeId INTEGER,
      salemanId TEXT UNIQUE,
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      FOREIGN KEY (routeId) REFERENCES routes(id)
    );
    CREATE INDEX IF NOT EXISTS idx_saleman_salemanId ON saleman(salemanId);
    CREATE INDEX IF NOT EXISTS idx_saleman_routeId ON saleman(routeId);
    CREATE INDEX IF NOT EXISTS idx_saleman_deleted ON saleman(deletedAt);
  `);

  // Order Takers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_takers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      number TEXT NOT NULL,
      cnic TEXT,
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_order_takers_deleted ON order_takers(deletedAt);
  `);

  // Shops table
  db.exec(`
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ownerName TEXT,
      phone TEXT,
      cnic TEXT,
      currentCredit REAL DEFAULT 0,
      routeId INTEGER,
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      FOREIGN KEY (routeId) REFERENCES routes(id)
    );
    CREATE INDEX IF NOT EXISTS idx_shops_routeId ON shops(routeId);
    CREATE INDEX IF NOT EXISTS idx_shops_deleted ON shops(deletedAt);
  `);

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      passwordHash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deletedAt);
  `);

  // Invoice Counter table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_counters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      lastNumber INTEGER DEFAULT 0,
      createdAt INTEGER,
      updatedAt INTEGER
    );
  `);

  // Sales table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceId INTEGER NOT NULL,
      date INTEGER NOT NULL,
      salemanId INTEGER,
      shopId INTEGER,
      items TEXT NOT NULL,
      totalDiscount REAL DEFAULT 0,
      totalAmount REAL NOT NULL DEFAULT 0,
      paymentType TEXT NOT NULL,
      cashCollected REAL DEFAULT 0,
      creditRemaining REAL DEFAULT 0,
      status TEXT DEFAULT 'unpaid',
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      FOREIGN KEY (salemanId) REFERENCES saleman(id),
      FOREIGN KEY (shopId) REFERENCES shops(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sales_invoiceId ON sales(invoiceId);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
    CREATE INDEX IF NOT EXISTS idx_sales_salemanId ON sales(salemanId);
    CREATE INDEX IF NOT EXISTS idx_sales_shopId ON sales(shopId);
    CREATE INDEX IF NOT EXISTS idx_sales_deleted ON sales(deletedAt);
  `);

  // Migration: rename staff to saleman
  try {
    const tableList = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);

    // 1. Rename staff table to saleman if it exists
    if (tableList.includes("staff") && !tableList.includes("saleman")) {
      db.exec("ALTER TABLE staff RENAME TO saleman");
      console.log("Renamed table 'staff' to 'saleman'");
    }

    // 2. Rename columns in saleman table
    if (tableList.includes("staff") || tableList.includes("saleman")) {
      const salemanCols = db.prepare("PRAGMA table_info(saleman)").all().map(c => c.name);
      if (salemanCols.includes("staffId") && !salemanCols.includes("salemanId")) {
        db.exec("ALTER TABLE saleman RENAME COLUMN staffId TO salemanId");
      }
    }

    // 3. Rename columns in routes table
    if (tableList.includes("routes")) {
      const routesCols = db.prepare("PRAGMA table_info(routes)").all().map(c => c.name);
      if (routesCols.includes("assignedStaff") && !routesCols.includes("assignedSaleman")) {
        db.exec("ALTER TABLE routes RENAME COLUMN assignedStaff TO assignedSaleman");
      }
    }

    // 4. Rename columns in sales table
    if (tableList.includes("sales")) {
      const salesCols = db.prepare("PRAGMA table_info(sales)").all().map(c => c.name);
      if (salesCols.includes("staffId") && !salesCols.includes("salemanId")) {
        db.exec("ALTER TABLE sales RENAME COLUMN staffId TO salemanId");
      }
    }

    // 5. Rename columns in daily_sales_summaries table
    if (tableList.includes("daily_sales_summaries")) {
      const summaryCols = db.prepare("PRAGMA table_info(daily_sales_summaries)").all().map(c => c.name);
      if (summaryCols.includes("staffId") && !summaryCols.includes("salemanId")) {
        db.exec("ALTER TABLE daily_sales_summaries RENAME COLUMN staffId TO salemanId");
      }
    }
    // 6. Add buyPrice and totalBought to products table
    try {
      const productCols = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
      if (!productCols.includes("buyPrice")) {
        db.exec("ALTER TABLE products ADD COLUMN buyPrice REAL NOT NULL DEFAULT 0");
      }
      if (!productCols.includes("totalBought")) {
        db.exec("ALTER TABLE products ADD COLUMN totalBought REAL DEFAULT 0");
      }
    } catch (e) {
      console.error("Migration error (products buyPrice):", e);
    }
  } catch (e) {
    console.error("Migration error (staff to saleman):", e);
  }

  // Migrate sales table: add orderTakerId and orderTakeDate if they don't exist
  try {
    const salesColumns = db.prepare("PRAGMA table_info(sales)").all();
    const colNames = salesColumns.map((c) => c.name);
    if (!colNames.includes("orderTakerId")) {
      db.exec("ALTER TABLE sales ADD COLUMN orderTakerId INTEGER REFERENCES order_takers(id)");
    }
    if (!colNames.includes("orderTakeDate")) {
      db.exec("ALTER TABLE sales ADD COLUMN orderTakeDate INTEGER");
    }
    if (!colNames.includes("totalDiscount")) {
      db.exec("ALTER TABLE sales ADD COLUMN totalDiscount REAL DEFAULT 0");
    }
  } catch (e) {
    // Ignore migration errors (e.g. column already exists from manual migration)
  }

  // Migrate all tables: add userId for multi-tenant data isolation
  const tablesWithUserId = [
    "products", "routes", "saleman", "order_takers", "shops",
    "sales", "daily_sales_summaries", "credit_payments", "returns",
  ];
  for (const table of tablesWithUserId) {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all();
      const hasUserId = cols.some((c) => c.name === "userId");
      if (!hasUserId) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN userId TEXT`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_userId ON ${table}(userId)`);
      }
    } catch (e) {
      // Ignore (e.g. table doesn't exist)
    }
  }

  // Daily Sales Summary table
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_sales_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salemanId INTEGER NOT NULL,
      date INTEGER NOT NULL,
      cashSales REAL NOT NULL DEFAULT 0,
      creditSales REAL NOT NULL DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      FOREIGN KEY (salemanId) REFERENCES saleman(id),
      UNIQUE(salemanId, date)
    );
    CREATE INDEX IF NOT EXISTS idx_daily_summaries_salemanId ON daily_sales_summaries(salemanId);
    CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_sales_summaries(date);
    CREATE INDEX IF NOT EXISTS idx_daily_summaries_deleted ON daily_sales_summaries(deletedAt);
  `);

  // Credit Payments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS credit_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shopId INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      date INTEGER NOT NULL,
      note TEXT,
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      FOREIGN KEY (shopId) REFERENCES shops(id)
    );
    CREATE INDEX IF NOT EXISTS idx_credit_payments_shopId ON credit_payments(shopId);
    CREATE INDEX IF NOT EXISTS idx_credit_payments_date ON credit_payments(date);
    CREATE INDEX IF NOT EXISTS idx_credit_payments_deleted ON credit_payments(deletedAt);
  `);

  // Returns table
  db.exec(`
    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      saleId INTEGER NOT NULL,
      productId INTEGER NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      reason TEXT,
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      FOREIGN KEY (saleId) REFERENCES sales(id),
      FOREIGN KEY (productId) REFERENCES products(id)
    );
    CREATE INDEX IF NOT EXISTS idx_returns_saleId ON returns(saleId);
    CREATE INDEX IF NOT EXISTS idx_returns_productId ON returns(productId);
    CREATE INDEX IF NOT EXISTS idx_returns_deleted ON returns(deletedAt);
  `);

  // Expenses table
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT,
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL DEFAULT 0,
      date INTEGER NOT NULL,
      salemanId INTEGER,
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      FOREIGN KEY (salemanId) REFERENCES saleman(id)
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_userId ON expenses(userId);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_deleted ON expenses(deletedAt);
  `);

  // Product Purchases table
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT,
      productId INTEGER NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      buyPrice REAL NOT NULL DEFAULT 0,
      totalAmount REAL NOT NULL DEFAULT 0,
      date INTEGER NOT NULL,
      supplier TEXT,
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      FOREIGN KEY (productId) REFERENCES products(id)
    );
    CREATE INDEX IF NOT EXISTS idx_purchases_userId ON product_purchases(userId);
    CREATE INDEX IF NOT EXISTS idx_purchases_productId ON product_purchases(productId);
    CREATE INDEX IF NOT EXISTS idx_purchases_date ON product_purchases(date);
    CREATE INDEX IF NOT EXISTS idx_purchases_deleted ON product_purchases(deletedAt);
  `);

  // Saleman Payments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS saleman_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT,
      salemanId INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      date INTEGER NOT NULL,
      type TEXT NOT NULL,
      month TEXT NOT NULL,
      description TEXT,
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      FOREIGN KEY (salemanId) REFERENCES saleman(id)
    );
    CREATE INDEX IF NOT EXISTS idx_saleman_payments_userId ON saleman_payments(userId);
    CREATE INDEX IF NOT EXISTS idx_saleman_payments_salemanId ON saleman_payments(salemanId);
    CREATE INDEX IF NOT EXISTS idx_saleman_payments_date ON saleman_payments(date);
    CREATE INDEX IF NOT EXISTS idx_saleman_payments_deleted ON saleman_payments(deletedAt);
  `);
}

/**
 * Get SQLite database instance
 */
export function getSQLiteDB() {
  return dbInstance;
}

/**
 * Close SQLite database connection
 */
export function closeSQLite() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
