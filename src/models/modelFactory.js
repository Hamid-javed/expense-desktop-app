import { isMongoDB, isSQLite } from "../lib/db/index.js";

/**
 * Get the appropriate model based on database type
 */
export function getModel(mongooseModel, sqliteModel) {
  if (isMongoDB()) {
    return mongooseModel;
  } else {
    return sqliteModel;
  }
}
