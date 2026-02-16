import fs from "fs";
import path from "path";

/**
 * Get database configuration from environment or config file
 */
export function getDbConfig() {
  // Check environment variable first
  const dbType = process.env.DB_TYPE || "sqlite";

  // Determine database path based on environment
  let dbPath;
  if (process.env.DB_PATH) {
    dbPath = process.env.DB_PATH;
  } else {
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";
    if (isDev) {
      // Development: use data/ directory in project root
      dbPath = path.join(process.cwd(), "data", "expense_app.db");
    } else {
      // Production: try to use Electron userData directory if available
      // This will be set by Electron main process via environment variable
      const electronUserData = process.env.ELECTRON_USER_DATA;
      if (electronUserData) {
        dbPath = path.join(electronUserData, "expense_app.db");
      } else {
        // Fallback: use data/ directory
        dbPath = path.join(process.cwd(), "data", "expense_app.db");
      }
    }
  }

  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  return {
    type: dbType,
    path: dbPath,
    mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/expense_app",
  };
}
