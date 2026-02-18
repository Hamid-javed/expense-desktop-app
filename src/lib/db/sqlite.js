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
      quantity REAL DEFAULT 0,
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
      assignedStaff INTEGER,
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      FOREIGN KEY (assignedStaff) REFERENCES staff(id)
    );
    CREATE INDEX IF NOT EXISTS idx_routes_deleted ON routes(deletedAt);
  `);

  // Staff table
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      cnic TEXT,
      routeId INTEGER,
      staffId TEXT UNIQUE,
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      FOREIGN KEY (routeId) REFERENCES routes(id)
    );
    CREATE INDEX IF NOT EXISTS idx_staff_staffId ON staff(staffId);
    CREATE INDEX IF NOT EXISTS idx_staff_routeId ON staff(routeId);
    CREATE INDEX IF NOT EXISTS idx_staff_deleted ON staff(deletedAt);
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
      staffId INTEGER,
      shopId INTEGER,
      items TEXT NOT NULL,
      totalAmount REAL NOT NULL DEFAULT 0,
      paymentType TEXT NOT NULL,
      cashCollected REAL DEFAULT 0,
      creditRemaining REAL DEFAULT 0,
      status TEXT DEFAULT 'unpaid',
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      FOREIGN KEY (staffId) REFERENCES staff(id),
      FOREIGN KEY (shopId) REFERENCES shops(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sales_invoiceId ON sales(invoiceId);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
    CREATE INDEX IF NOT EXISTS idx_sales_staffId ON sales(staffId);
    CREATE INDEX IF NOT EXISTS idx_sales_shopId ON sales(shopId);
    CREATE INDEX IF NOT EXISTS idx_sales_deleted ON sales(deletedAt);
  `);

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
  } catch (e) {
    // Ignore migration errors (e.g. column already exists from manual migration)
  }

  // Daily Sales Summary table
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_sales_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staffId INTEGER NOT NULL,
      date INTEGER NOT NULL,
      cashSales REAL NOT NULL DEFAULT 0,
      creditSales REAL NOT NULL DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      FOREIGN KEY (staffId) REFERENCES staff(id),
      UNIQUE(staffId, date)
    );
    CREATE INDEX IF NOT EXISTS idx_daily_summaries_staffId ON daily_sales_summaries(staffId);
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
