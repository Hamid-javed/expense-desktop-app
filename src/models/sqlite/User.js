import { SQLiteModel } from "./base.js";
import { SQLiteQuery } from "./QueryWrapper.js";

class UserModel extends SQLiteModel {
  constructor() {
    super("users");
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
    if (query.email) {
      sql += ` AND email = ?`;
      params.push(query.email);
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

export const User = new UserModel();
