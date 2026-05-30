# SQLite User Isolation + Auto Admin + Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full user data isolation in SQLite mode, auto-create admin@gmail.com/admin123 on first install, and clean backup UI.

**Architecture:** Fix `withUserId` to work for SQLite, add userId filtering to all SQLite models, always store userId on create, namespace invoice counter per user via key prefix, seed admin on empty DB.

**Tech Stack:** Next.js App Router, better-sqlite3, bcryptjs, Server Actions

---

### Task 1: Fix `withUserId` + `withUserIdForAggregate` for SQLite

**Files:**
- Modify: `src/lib/tenant.js`

- [ ] Remove the `if (!isMongoDB()) return filter` guard from both functions so SQLite also receives userId in every query/filter.

```js
import mongoose from "mongoose";

export function withUserId(userId, filter = {}) {
  return { userId, ...filter };
}

export function withUserIdForAggregate(userId, filter = {}) {
  return { userId, ...filter };
}
```

---

### Task 2: Add userId to `SQLiteModel` base `find`, `findOne`, `aggregate`

**Files:**
- Modify: `src/models/sqlite/base.js`

- [ ] In `find()`, after the `_id` check, add:
```js
if (query.userId !== undefined) {
  sql += ` AND userId = ?`;
  params.push(query.userId);
}
```

- [ ] In `findOne()`, same block.

- [ ] In `aggregate()`, inside the `$match` handler, add:
```js
if (match.userId !== undefined) {
  whereConditions.push(`userId = ?`);
  params.push(match.userId);
}
```

---

### Task 3: Add userId to all overriding SQLite `find`/`findOne` methods

**Files:**
- Modify: `src/models/sqlite/Shop.js`
- Modify: `src/models/sqlite/Sale.js`
- Modify: `src/models/sqlite/Product.js`
- Modify: `src/models/sqlite/Route.js`
- Modify: `src/models/sqlite/Saleman.js`
- Modify: `src/models/sqlite/OrderTaker.js`
- Modify: `src/models/sqlite/DailySalesSummary.js`
- Modify: `src/models/sqlite/CreditPayment.js`
- Modify: `src/models/sqlite/Return.js`
- Modify: `src/models/sqlite/InvoiceCounter.js`

Each model's `find` and `findOne` override must add, before the `LIMIT 1` (for findOne) or before the final query run (for find):
```js
if (query.userId !== undefined) {
  sql += ` AND userId = ?`;
  params.push(query.userId);
}
```

For `InvoiceCounter`, `findOne` and `findOneAndUpdate` must also handle userId.

---

### Task 4: Always store `userId` on create (remove `isMongoDB()` guards)

**Files:**
- Modify: `src/app/shops/actions.js`
- Modify: `src/app/routes/actions.js`
- Modify: `src/app/saleman/actions.js`
- Modify: `src/app/products/actions.js`
- Modify: `src/app/order-takers/actions.js`
- Modify: `src/app/shops/[id]/actions.js`
- Modify: `src/app/saleman/[id]/sales/actions.js`
- Modify: `src/app/sales/actions.js`

Replace all patterns like:
```js
await Model.create(isMongoDB() ? { userId, ...data } : data);
```
with:
```js
await Model.create({ userId, ...data });
```

Also fix sale update to always use userId in the filter:
```js
const saleFilter = { _id: saleId, userId };
```

---

### Task 5: Fix InvoiceCounter to be per-user in SQLite

**Files:**
- Modify: `src/app/sales/actions.js`

Change `getNextInvoiceNumber` to use a user-namespaced key for SQLite:
```js
async function getNextInvoiceNumber(userId) {
  const key = isMongoDB() ? "invoice" : `${userId}:invoice`;
  const query = isMongoDB() ? { userId, key } : { key };
  const counter = await InvoiceCounter.findOneAndUpdate(
    query,
    { $inc: { lastNumber: 1 } },
    { new: true, upsert: true }
  );
  return counter.lastNumber;
}
```

---

### Task 6: Auto-create admin account on first install

**Files:**
- Modify: `src/lib/db/sqlite.js`

After `initializeSchema(dbInstance)`, call `seedDefaultAdmin(dbInstance)`.

```js
import bcrypt from "bcryptjs";

function seedDefaultAdmin(db) {
  const count = db.prepare("SELECT COUNT(*) as count FROM users").get();
  if (count.count > 0) return;
  const hash = bcrypt.hashSync("admin123", 10);
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (email, name, passwordHash, role, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run("admin@gmail.com", "Admin", hash, "admin", 1, now, now);
}
```

---

### Task 7: Clean backup UI in settings

**Files:**
- Modify: `src/app/api/export/route.js`
- Modify: `src/app/settings/page.js`

Add `type=full` to export route (full DB dump, clear filename).
Replace the confusing daily/monthly export buttons with a single "Backup Database" button.

---
