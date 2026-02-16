import { SQLiteModel } from "./base.js";
import { SQLiteQuery } from "./QueryWrapper.js";

class InvoiceCounterModel extends SQLiteModel {
  constructor() {
    super("invoice_counters");
  }

  /**
   * Find by ID (override to exclude deletedAt check)
   */
  findById(id) {
    const db = this.getDB();
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ? LIMIT 1`;
    const row = db.prepare(sql).get(id);
    const result = this.rowToObject(row);
    return new SQLiteQuery(this, { _id: id }, result);
  }

  /**
   * Create a new record (override to exclude deletedAt)
   */
  async create(data) {
    const db = this.getDB();
    const row = this.objectToRow(data);
    // Remove deletedAt since invoice_counters table doesn't have this column
    delete row.deletedAt;
    const columns = Object.keys(row).filter((k) => k !== "id");
    const placeholders = columns.map(() => "?").join(", ");
    const values = columns.map((col) => row[col]);

    const sql = `INSERT INTO ${this.tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
    const result = db.prepare(sql).run(...values);
    const queryWrapper = this.findById(result.lastInsertRowid);
    return await queryWrapper.execute();
  }

  /**
   * Find records (override to exclude deletedAt check)
   */
  find(query = {}) {
    const db = this.getDB();
    let sql = `SELECT * FROM ${this.tableName}`;
    const params = [];

    // Handle query conditions
    if (query._id) {
      sql += ` WHERE id = ?`;
      params.push(query._id);
    } else if (query.key) {
      sql += ` WHERE key = ?`;
      params.push(query.key);
    } else if (Object.keys(query).length > 0) {
      const conditions = [];
      for (const [key, value] of Object.entries(query)) {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(" AND ")}`;
      }
    }

    const rows = db.prepare(sql).all(...params);
    const results = rows.map((row) => this.rowToObject(row));
    return new SQLiteQuery(this, query, results);
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

  /**
   * Count documents (override to exclude deletedAt check)
   */
  countDocuments(query = {}) {
    const db = this.getDB();
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params = [];

    if (query._id) {
      sql += ` WHERE id = ?`;
      params.push(query._id);
    } else if (Object.keys(query).length > 0) {
      const conditions = [];
      for (const [key, value] of Object.entries(query)) {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(" AND ")}`;
      }
    }

    const result = db.prepare(sql).get(...params);
    return result ? result.count : 0;
  }

  async findOneAndUpdate(query, update, options = {}) {
    const db = this.getDB();
    const queryWrapper = this.findOne(query);
    const existing = await queryWrapper.execute();

    if (existing) {
      const id = existing.id || existing._id;
      
      // Handle MongoDB-style operators
      let finalUpdate = { ...update };
      
      // Handle $inc operator
      if (update.$inc) {
        // Copy existing but exclude MongoDB-specific fields (_id, id)
        finalUpdate = {};
        for (const [key, value] of Object.entries(existing)) {
          // Skip _id, id - these are not table columns
          if (key !== '_id' && key !== 'id') {
            finalUpdate[key] = value;
          }
        }
        for (const [field, increment] of Object.entries(update.$inc)) {
          const currentValue = finalUpdate[field] || 0;
          finalUpdate[field] = currentValue + increment;
        }
        // Merge any other non-operator fields
        for (const [key, value] of Object.entries(update)) {
          if (key !== '$inc' && !key.startsWith('$') && key !== '_id' && key !== 'id') {
            finalUpdate[key] = value;
          }
        }
      } else {
        // For non-$inc updates, also filter out _id
        finalUpdate = {};
        for (const [key, value] of Object.entries(update)) {
          if (key !== '_id' && key !== 'id' && !key.startsWith('$')) {
            finalUpdate[key] = value;
          }
        }
      }
      
      const row = this.objectToRow(finalUpdate);
      delete row.id;
      delete row._id; // Remove _id in case it got through
      delete row.deletedAt; // Remove deletedAt since table doesn't have it
      const columns = Object.keys(row);
      const setClause = columns.map((col) => `${col} = ?`).join(", ");
      const values = columns.map((col) => row[col]);
      values.push(id);

      const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
      db.prepare(sql).run(...values);
      const resultWrapper = this.findOne(query);
      return await resultWrapper.execute();
    } else if (options.upsert) {
      // Handle $inc for upsert - start from 0 if not exists
      let finalUpdate = { ...update };
      if (update.$inc) {
        finalUpdate = {};
        for (const [field, increment] of Object.entries(update.$inc)) {
          finalUpdate[field] = increment; // Start from increment value for new record
        }
        // Merge any other non-operator fields
        for (const [key, value] of Object.entries(update)) {
          if (key !== '$inc' && !key.startsWith('$')) {
            finalUpdate[key] = value;
          }
        }
      }
      return await this.create({ ...query, ...finalUpdate });
    }
    return null;
  }

  /**
   * Delete many (hard delete - invoice_counters doesn't have deletedAt)
   */
  deleteMany(query = {}) {
    const db = this.getDB();
    let sql = `DELETE FROM ${this.tableName}`;
    const params = [];

    if (query._id || query.id) {
      sql += ` WHERE id = ?`;
      params.push(query._id || query.id);
    } else if (Object.keys(query).length > 0) {
      // Handle other query conditions if needed
      const conditions = [];
      for (const [key, value] of Object.entries(query)) {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(" AND ")}`;
      }
    }

    const result = db.prepare(sql).run(...params);
    return { deletedCount: result.changes };
  }
}

export const InvoiceCounter = new InvoiceCounterModel();
