/**
 * Always prepends userId to filter for multi-tenant data isolation.
 * Works for both MongoDB and SQLite.
 */
export function withUserId(userId, filter = {}) {
  return { userId, ...filter };
}

/**
 * Same as withUserId — used in aggregate $match stages.
 * MongoDB ObjectId casting is handled by Mongoose automatically in aggregate pipelines.
 */
export function withUserIdForAggregate(userId, filter = {}) {
  return { userId, ...filter };
}
