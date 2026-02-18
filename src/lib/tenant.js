import mongoose from "mongoose";
import { isMongoDB } from "./db";

/**
 * When using MongoDB, prepends userId to filter for multi-tenant data isolation.
 * When using SQLite, returns the filter as-is (no tenant isolation).
 */
export function withUserId(userId, filter = {}) {
  if (!isMongoDB()) return filter;
  return { userId, ...filter };
}

/**
 * Same as withUserId but converts userId to ObjectId for MongoDB aggregation pipelines.
 * Mongoose find() auto-casts strings, but aggregate $match may not.
 */
export function withUserIdForAggregate(userId, filter = {}) {
  if (!isMongoDB()) return filter;
  const oid = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : userId;
  return { userId: oid, ...filter };
}
