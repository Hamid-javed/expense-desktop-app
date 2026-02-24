import { SQLiteModel } from "./base.js";
import { SQLiteQuery } from "./QueryWrapper.js";

class SalemanModel extends SQLiteModel {
  constructor() {
    super("saleman");
  }

  find(query = {}) {
    const db = this.getDB();
    let sql = `SELECT * FROM ${this.tableName} WHERE deletedAt IS NULL`;
    const params = [];

    // Handle MongoDB-style $in operator
    if (query._id && typeof query._id === 'object' && query._id.$in) {
      const ids = Array.isArray(query._id.$in) ? query._id.$in : [query._id.$in];
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(', ');
        sql += ` AND id IN (${placeholders})`;
        params.push(...ids);
      } else {
        // Empty $in means no results
        sql += ` AND 1 = 0`; // Always false condition
      }
    } else if (query._id) {
      sql += ` AND id = ?`;
      params.push(query._id);
    }

    if (query.routeId) {
      sql += ` AND routeId = ?`;
      params.push(query.routeId);
    }
    if (query.salemanId) {
      sql += ` AND salemanId = ?`;
      params.push(query.salemanId);
    }
    if (query.isActive !== undefined) {
      sql += ` AND isActive = ?`;
      params.push(query.isActive ? 1 : 0);
    }

    const rows = db.prepare(sql).all(...params);
    const results = rows.map((row) => this.rowToObject(row));
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
    if (query.salemanId) {
      sql += ` AND salemanId = ?`;
      params.push(query.salemanId);
    }
    if (query.isActive !== undefined) {
      sql += ` AND isActive = ?`;
      params.push(query.isActive ? 1 : 0);
    }

    sql += ` LIMIT 1`;
    const row = db.prepare(sql).get(...params);
    const result = this.rowToObject(row);
    return new SQLiteQuery(this, query, result);
  }
}

export const Saleman = new SalemanModel();
