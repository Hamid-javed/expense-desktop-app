import { getDbConfig } from "./config.js";
import { connectMongoDB } from "./mongodb.js";
import { connectSQLite } from "./sqlite.js";
import { getFriendlyConnectionMessage } from "./connectionError.js";

let currentDbType = null;
let dbConfig = null;

/**
 * Connect to database based on configuration.
 * Network errors (e.g. MongoDB SRV timeout when offline) are rethrown with a user-friendly message.
 */
export async function connectToDatabase() {
  if (!dbConfig) {
    dbConfig = getDbConfig();
  }

  currentDbType = dbConfig.type;

  try {
    if (currentDbType === "mongodb") {
      return await connectMongoDB();
    } else {
      return connectSQLite(dbConfig.path);
    }
  } catch (err) {
    throw new Error(getFriendlyConnectionMessage(err));
  }
}

/**
 * Get current database type
 */
export function getDbType() {
  if (!dbConfig) {
    dbConfig = getDbConfig();
  }
  return dbConfig.type || "sqlite";
}

/**
 * Get database path (for SQLite)
 */
export function getDbPath() {
  if (!dbConfig) {
    dbConfig = getDbConfig();
  }
  return dbConfig.path;
}

/**
 * Check if using MongoDB
 */
export function isMongoDB() {
  return getDbType() === "mongodb";
}

/**
 * Check if using SQLite
 */
export function isSQLite() {
  return getDbType() === "sqlite";
}
