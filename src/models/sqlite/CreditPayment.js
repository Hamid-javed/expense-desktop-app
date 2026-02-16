import { SQLiteModel } from "./base.js";
import { SQLiteQuery } from "./QueryWrapper.js";

class CreditPaymentModel extends SQLiteModel {
  constructor() {
    super("credit_payments");
  }

  rowToObject(row) {
    if (!row) return null;
    const obj = super.rowToObject(row);
    // Convert date from integer to Date
    if (obj.date) {
      obj.date = new Date(obj.date);
    }
    return obj;
  }

  objectToRow(obj) {
    const row = super.objectToRow(obj);
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
    if (query.date) {
      if (query.date.$gte && query.date.$lte) {
        const start = query.date.$gte instanceof Date ? query.date.$gte.getTime() : query.date.$gte;
        const end = query.date.$lte instanceof Date ? query.date.$lte.getTime() : query.date.$lte;
        sql += ` AND date >= ? AND date <= ?`;
        params.push(start, end);
      }
    }

    const rows = db.prepare(sql).all(...params);
    const results = rows.map((row) => this.rowToObject(row));
    return new SQLiteQuery(this, query, results);
  }
}

export const CreditPayment = new CreditPaymentModel();
