import { SQLiteModel } from "./base.js";
import { SQLiteQuery } from "./QueryWrapper.js";

class ReturnModelClass extends SQLiteModel {
  constructor() {
    super("returns");
  }

  find(query = {}) {
    const db = this.getDB();
    let sql = `SELECT * FROM ${this.tableName} WHERE deletedAt IS NULL`;
    const params = [];

    if (query._id) {
      sql += ` AND id = ?`;
      params.push(query._id);
    }
    if (query.saleId) {
      sql += ` AND saleId = ?`;
      params.push(query.saleId);
    }
    if (query.productId) {
      sql += ` AND productId = ?`;
      params.push(query.productId);
    }
    if (query.isActive !== undefined) {
      sql += ` AND isActive = ?`;
      params.push(query.isActive ? 1 : 0);
    }

    const rows = db.prepare(sql).all(...params);
    const results = rows.map((row) => this.rowToObject(row));
    return new SQLiteQuery(this, query, results);
  }
}

export const ReturnModel = new ReturnModelClass();
