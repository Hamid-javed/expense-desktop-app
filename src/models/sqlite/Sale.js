import { SQLiteModel } from "./base.js";
import { SQLiteQuery } from "./QueryWrapper.js";

class SaleModel extends SQLiteModel {
  constructor() {
    super("sales");
  }

  rowToObject(row) {
    if (!row) return null;
    const obj = super.rowToObject(row);
    // Parse items JSON
    if (obj.items && typeof obj.items === "string") {
      try {
        obj.items = JSON.parse(obj.items);
      } catch (e) {
        obj.items = [];
      }
    }
    // Convert date from integer to Date
    if (obj.date) {
      obj.date = new Date(obj.date);
    }
    return obj;
  }

  objectToRow(obj) {
    const row = super.objectToRow(obj);
    // Convert items to JSON string
    if (Array.isArray(row.items)) {
      row.items = JSON.stringify(row.items);
    }
    // Convert date from Date to integer
    if (row.date instanceof Date) {
      row.date = row.date.getTime();
    }
    return row;
  }

  find(query = {}) {
    const db = this.getDB();
    let sql = `SELECT * FROM ${this.tableName} WHERE deletedAt IS NULL`;
    const params = [];

    if (query._id) {
      sql += ` AND id = ?`;
      params.push(query._id);
    }
    if (query.shopId) {
      sql += ` AND shopId = ?`;
      params.push(query.shopId);
    }
    if (query.staffId) {
      sql += ` AND staffId = ?`;
      params.push(query.staffId);
    }
    if (query.date) {
      if (typeof query.date === 'object') {
        if (query.date.$gte !== undefined) {
          const start = query.date.$gte instanceof Date ? query.date.$gte.getTime() : query.date.$gte;
          sql += ` AND date >= ?`;
          params.push(start);
        }
        if (query.date.$lte !== undefined) {
          const end = query.date.$lte instanceof Date ? query.date.$lte.getTime() : query.date.$lte;
          sql += ` AND date <= ?`;
          params.push(end);
        }
        if (query.date.$gt !== undefined) {
          const start = query.date.$gt instanceof Date ? query.date.$gt.getTime() : query.date.$gt;
          sql += ` AND date > ?`;
          params.push(start);
        }
        if (query.date.$lt !== undefined) {
          const end = query.date.$lt instanceof Date ? query.date.$lt.getTime() : query.date.$lt;
          sql += ` AND date < ?`;
          params.push(end);
        }
      } else {
        // Direct date value
        const dateValue = query.date instanceof Date ? query.date.getTime() : query.date;
        sql += ` AND date = ?`;
        params.push(dateValue);
      }
    }
    if (query.status) {
      sql += ` AND status = ?`;
      params.push(query.status);
    }
    if (query.creditRemaining) {
      if (typeof query.creditRemaining === 'object' && query.creditRemaining.$gt !== undefined) {
        sql += ` AND creditRemaining > ?`;
        params.push(query.creditRemaining.$gt);
      } else {
        sql += ` AND creditRemaining = ?`;
        params.push(query.creditRemaining);
      }
    }
    if (query.isActive !== undefined) {
      sql += ` AND isActive = ?`;
      params.push(query.isActive ? 1 : 0);
    }

    // Handle $or queries
    if (query.$or) {
      const orConditions = [];
      query.$or.forEach((condition) => {
        if (condition.status) {
          orConditions.push(`status = ?`);
          params.push(condition.status);
        }
        if (condition.creditRemaining && condition.creditRemaining.$gt !== undefined) {
          orConditions.push(`creditRemaining > ?`);
          params.push(condition.creditRemaining.$gt);
        }
      });
      if (orConditions.length > 0) {
        sql += ` AND (${orConditions.join(" OR ")})`;
      }
    }

    const rows = db.prepare(sql).all(...params);
    const results = rows.map((row) => this.rowToObject(row));
    // Return query wrapper for chaining
    return new SQLiteQuery(this, query, results);
  }

  findOne(query = {}) {
    const db = this.getDB();
    let sql = `SELECT * FROM ${this.tableName} WHERE deletedAt IS NULL`;
    const params = [];

    if (query._id) {
      sql += ` AND id = ?`;
      params.push(query._id);
    } else if (query.id) {
      sql += ` AND id = ?`;
      params.push(query.id);
    }
    if (query.invoiceId) {
      sql += ` AND invoiceId = ?`;
      params.push(query.invoiceId);
    }
    if (query.shopId) {
      sql += ` AND shopId = ?`;
      params.push(query.shopId);
    }
    if (query.staffId) {
      sql += ` AND staffId = ?`;
      params.push(query.staffId);
    }
    if (query.date) {
      if (typeof query.date === 'object') {
        if (query.date.$gte !== undefined) {
          const start = query.date.$gte instanceof Date ? query.date.$gte.getTime() : query.date.$gte;
          sql += ` AND date >= ?`;
          params.push(start);
        }
        if (query.date.$lte !== undefined) {
          const end = query.date.$lte instanceof Date ? query.date.$lte.getTime() : query.date.$lte;
          sql += ` AND date <= ?`;
          params.push(end);
        }
        if (query.date.$gt !== undefined) {
          const start = query.date.$gt instanceof Date ? query.date.$gt.getTime() : query.date.$gt;
          sql += ` AND date > ?`;
          params.push(start);
        }
        if (query.date.$lt !== undefined) {
          const end = query.date.$lt instanceof Date ? query.date.$lt.getTime() : query.date.$lt;
          sql += ` AND date < ?`;
          params.push(end);
        }
      } else {
        // Direct date value
        const dateValue = query.date instanceof Date ? query.date.getTime() : query.date;
        sql += ` AND date = ?`;
        params.push(dateValue);
      }
    }

    sql += ` LIMIT 1`;
    const row = db.prepare(sql).get(...params);
    const result = this.rowToObject(row);
    // Return query wrapper for chaining (base class would do this, but we override)
    return new SQLiteQuery(this, query, result);
  }
}

export const Sale = new SaleModel();
