import { SQLiteModel } from "./base.js";
import { SQLiteQuery } from "./QueryWrapper.js";

class RouteModelClass extends SQLiteModel {
  constructor() {
    super("routes");
  }

  find(query = {}) {
    const db = this.getDB();
    let sql = `SELECT * FROM ${this.tableName} WHERE deletedAt IS NULL`;
    const params = [];

    // Handle MongoDB-style $ne operator
    if (query._id && typeof query._id === 'object' && query._id.$ne !== undefined) {
      sql += ` AND id != ?`;
      params.push(query._id.$ne);
    } else if (query._id) {
      sql += ` AND id = ?`;
      params.push(query._id);
    }

    if (query.assignedSaleman) {
      sql += ` AND assignedSaleman = ?`;
      params.push(query.assignedSaleman);
    }
    if (query.name) {
      sql += ` AND name = ?`;
      params.push(query.name);
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
    if (query.name) {
      sql += ` AND name = ?`;
      params.push(query.name);
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

export const RouteModel = new RouteModelClass();
