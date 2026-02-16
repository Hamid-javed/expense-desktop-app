import { SQLiteModel } from "./base.js";
import { SQLiteQuery } from "./QueryWrapper.js";

class InvoiceCounterModel extends SQLiteModel {
  constructor() {
    super("invoice_counters");
  }

  findOne(query = {}) {
    const db = this.getDB();
    let sql = `SELECT * FROM ${this.tableName}`;
    const params = [];

    if (query.key) {
      sql += ` WHERE key = ?`;
      params.push(query.key);
    } else if (query._id || query.id) {
      sql += ` WHERE id = ?`;
      params.push(query._id || query.id);
    }

    sql += ` LIMIT 1`;
    const row = db.prepare(sql).get(...params);
    const result = this.rowToObject(row);
    return new SQLiteQuery(this, query, result);
  }

  async findOneAndUpdate(query, update, options = {}) {
    const db = this.getDB();
    const queryWrapper = this.findOne(query);
    const existing = await queryWrapper.execute();

    if (existing) {
      const id = existing.id || existing._id;
      const row = this.objectToRow(update);
      delete row.id;
      const columns = Object.keys(row);
      const setClause = columns.map((col) => `${col} = ?`).join(", ");
      const values = columns.map((col) => row[col]);
      values.push(id);

      const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
      db.prepare(sql).run(...values);
      const resultWrapper = this.findOne(query);
      return await resultWrapper.execute();
    } else if (options.upsert) {
      return await this.create({ ...query, ...update });
    }
    return null;
  }
}

export const InvoiceCounter = new InvoiceCounterModel();
