import { getSQLiteDB } from "../../lib/db/sqlite.js";
import { SQLiteQuery } from "./QueryWrapper.js";

/**
 * Base helper functions for SQLite models
 */
export class SQLiteModel {
  constructor(tableName) {
    this.tableName = tableName;
  }

  getDB() {
    const db = getSQLiteDB();
    if (!db) {
      throw new Error("SQLite database not initialized. Call connectToDatabase() first.");
    }
    return db;
  }

  /**
   * Convert SQLite row to object (handles null deletedAt, timestamps)
   */
  rowToObject(row) {
    if (!row) return null;
    const obj = { ...row };
    // Add _id for MongoDB compatibility (SQLite uses id)
    if (obj.id !== undefined && obj._id === undefined) {
      obj._id = obj.id;
    }
    // Convert deletedAt from integer to Date or null
    if (obj.deletedAt !== null && obj.deletedAt !== undefined) {
      obj.deletedAt = new Date(obj.deletedAt);
    } else {
      obj.deletedAt = null;
    }
    // Convert timestamps
    if (obj.createdAt) obj.createdAt = new Date(obj.createdAt);
    if (obj.updatedAt) obj.updatedAt = new Date(obj.updatedAt);
    // Convert isActive from integer to boolean
    if (obj.isActive !== undefined) obj.isActive = Boolean(obj.isActive);
    return obj;
  }

  /**
   * Convert object to SQLite row (handles Date to integer, boolean to integer)
   */
  objectToRow(obj) {
    const row = { ...obj };
    // Convert deletedAt from Date to integer or null
    if (row.deletedAt instanceof Date) {
      row.deletedAt = row.deletedAt.getTime();
    } else if (row.deletedAt === null || row.deletedAt === undefined) {
      row.deletedAt = null;
    }
    // Convert timestamps
    if (row.createdAt instanceof Date) {
      row.createdAt = row.createdAt.getTime();
    } else if (!row.createdAt) {
      row.createdAt = Date.now();
    }
    if (row.updatedAt instanceof Date) {
      row.updatedAt = row.updatedAt.getTime();
    } else {
      row.updatedAt = Date.now();
    }
    // Convert isActive from boolean to integer
    if (typeof row.isActive === "boolean") {
      row.isActive = row.isActive ? 1 : 0;
    }
    return row;
  }

  /**
   * Find all records matching query - returns query wrapper for chaining
   */
  find(query = {}) {
    const db = this.getDB();
    let sql = `SELECT * FROM ${this.tableName} WHERE deletedAt IS NULL`;
    const params = [];

    // Handle query conditions
    if (query._id) {
      sql += ` AND id = ?`;
      params.push(query._id);
    }
    if (query.isActive !== undefined) {
      sql += ` AND isActive = ?`;
      params.push(query.isActive ? 1 : 0);
    }

    const rows = db.prepare(sql).all(...params);
    const results = rows.map((row) => this.rowToObject(row));
    return new SQLiteQuery(this, query, results);
  }

  /**
   * Find one record matching query - returns query wrapper for chaining
   */
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
    if (query.isActive !== undefined) {
      sql += ` AND isActive = ?`;
      params.push(query.isActive ? 1 : 0);
    }

    sql += ` LIMIT 1`;
    const row = db.prepare(sql).get(...params);
    const result = this.rowToObject(row);
    return new SQLiteQuery(this, query, result);
  }

  /**
   * Find by ID - returns query wrapper for chaining
   */
  findById(id) {
    const db = this.getDB();
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ? AND deletedAt IS NULL LIMIT 1`;
    const row = db.prepare(sql).get(id);
    const result = this.rowToObject(row);
    return new SQLiteQuery(this, { _id: id }, result);
  }

  /**
   * Create a new record
   */
  async create(data) {
    const db = this.getDB();
    const row = this.objectToRow(data);
    const columns = Object.keys(row).filter((k) => k !== "id");
    const placeholders = columns.map(() => "?").join(", ");
    const values = columns.map((col) => row[col]);

    const sql = `INSERT INTO ${this.tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
    const result = db.prepare(sql).run(...values);
    const queryWrapper = this.findById(result.lastInsertRowid);
    return await queryWrapper.execute();
  }

  /**
   * Update a record
   */
  async updateOne(query, update) {
    const db = this.getDB();
    const id = query._id || query.id;
    if (!id) throw new Error("Update query must include _id or id");

    const row = this.objectToRow(update);
    delete row.id; // Don't update ID
    const columns = Object.keys(row);
    const setClause = columns.map((col) => `${col} = ?`).join(", ");
    const values = columns.map((col) => row[col]);
    values.push(id);

    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ? AND deletedAt IS NULL`;
    db.prepare(sql).run(...values);
    const queryWrapper = this.findById(id);
    return await queryWrapper.execute();
  }

  /**
   * Find by ID and update
   */
  async findByIdAndUpdate(id, update, options = {}) {
    return await this.updateOne({ _id: id }, update);
  }

  /**
   * Find one and update (with upsert support)
   */
  async findOneAndUpdate(query, update, options = {}) {
    const queryWrapper = this.findOne(query);
    const existing = await queryWrapper.execute();
    if (existing) {
      return this.updateOne(query, update);
    } else if (options.upsert) {
      return this.create({ ...query, ...update });
    }
    return null;
  }

  /**
   * Delete (soft delete by setting deletedAt)
   */
  deleteOne(query) {
    const db = this.getDB();
    const id = query._id || query.id;
    if (!id) throw new Error("Delete query must include _id or id");

    const sql = `UPDATE ${this.tableName} SET deletedAt = ? WHERE id = ?`;
    db.prepare(sql).run(Date.now(), id);
    return { deletedCount: 1 };
  }

  /**
   * Delete many (soft delete)
   */
  deleteMany(query) {
    const db = this.getDB();
    let sql = `UPDATE ${this.tableName} SET deletedAt = ? WHERE deletedAt IS NULL`;
    const params = [Date.now()];

    if (query._id) {
      sql += ` AND id = ?`;
      params.push(query._id);
    }

    const result = db.prepare(sql).run(...params);
    return { deletedCount: result.changes };
  }

  /**
   * Count documents
   */
  countDocuments(query = {}) {
    const db = this.getDB();
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE deletedAt IS NULL`;
    const params = [];

    if (query._id) {
      sql += ` AND id = ?`;
      params.push(query._id);
    }
    if (query.isActive !== undefined) {
      sql += ` AND isActive = ?`;
      params.push(query.isActive ? 1 : 0);
    }

    const result = db.prepare(sql).get(...params);
    return result.count;
  }

  /**
   * Insert many records
   */
  async insertMany(docs) {
    // Use Promise.all for async creates
    // Note: This is not transactional, but create() handles individual inserts
    return Promise.all(docs.map((doc) => this.create(doc)));
  }

  /**
   * Populate references (for compatibility with Mongoose)
   * Returns a promise that resolves with populated data
   */
  async populate(data, fields) {
    if (!data) return data;
    if (Array.isArray(data)) {
      return Promise.all(data.map((item) => this.populateItem(item, fields)));
    }
    return this.populateItem(data, fields);
  }

  /**
   * Populate a single item
   */
  async populateItem(item, fields) {
    if (!item || typeof fields !== "string") return item;
    
    // Handle nested populate like "items.productId"
    if (fields.includes(".")) {
      const [parentField, childField] = fields.split(".");
      if (Array.isArray(item[parentField])) {
        const populatedItems = await Promise.all(
          item[parentField].map(async (childItem) => {
            if (childItem[childField]) {
              const refModel = this.getRefModel(childField);
              if (refModel) {
                const refData = await refModel.findById(childItem[childField]);
                return { ...childItem, [childField]: refData };
              }
            }
            return childItem;
          })
        );
        return { ...item, [parentField]: populatedItems };
      }
    } else {
      // Simple populate
      if (item[fields]) {
        const refModel = this.getRefModel(fields);
        if (refModel) {
          const refData = await refModel.findById(item[fields]);
          return { ...item, [fields]: refData };
        }
      }
    }
    return item;
  }

  /**
   * Get reference model based on field name
   * Override in subclasses for specific relationships
   */
  getRefModel(fieldName) {
    // Default implementation - subclasses should override
    return null;
  }

  /**
   * Lean (return plain objects) - already done by default
   */
  lean() {
    return this;
  }

  /**
   * Sort results
   */
  sort(sortObj) {
    this._sort = sortObj;
    return this;
  }

  /**
   * Apply sorting to SQL query
   */
  applySort(sql) {
    if (this._sort) {
      const sortParts = [];
      for (const [field, direction] of Object.entries(this._sort)) {
        const dir = direction === -1 ? "DESC" : "ASC";
        sortParts.push(`${field} ${dir}`);
      }
      if (sortParts.length > 0) {
        sql += ` ORDER BY ${sortParts.join(", ")}`;
      }
      this._sort = null; // Reset after use
    }
    return sql;
  }

  /**
   * Aggregate pipeline (MongoDB-style) - converts to SQL
   */
  async aggregate(pipeline) {
    const db = this.getDB();
    const params = [];
    let whereConditions = [];
    let selectFields = [];
    let groupByFields = [];

    // Process pipeline stages
    for (const stage of pipeline) {
      // $match stage - build WHERE conditions
      if (stage.$match) {
        const match = stage.$match;
        
        if (match.deletedAt === null || match.deletedAt === undefined) {
          whereConditions.push("deletedAt IS NULL");
        }

        if (match.date) {
          if (match.date.$gte !== undefined) {
            const dateValue = match.date.$gte instanceof Date 
              ? match.date.$gte.getTime() 
              : match.date.$gte;
            whereConditions.push(`date >= ?`);
            params.push(dateValue);
          }
          if (match.date.$lte !== undefined) {
            const dateValue = match.date.$lte instanceof Date 
              ? match.date.$lte.getTime() 
              : match.date.$lte;
            whereConditions.push(`date <= ?`);
            params.push(dateValue);
          }
          if (match.date.$gt !== undefined) {
            const dateValue = match.date.$gt instanceof Date 
              ? match.date.$gt.getTime() 
              : match.date.$gt;
            whereConditions.push(`date > ?`);
            params.push(dateValue);
          }
          if (match.date.$lt !== undefined) {
            const dateValue = match.date.$lt instanceof Date 
              ? match.date.$lt.getTime() 
              : match.date.$lt;
            whereConditions.push(`date < ?`);
            params.push(dateValue);
          }
        }
      }

      // $group stage - build aggregation
      if (stage.$group) {
        const group = stage.$group;
        
        // Handle _id grouping
        if (group._id === null || group._id === undefined) {
          // No grouping - aggregate all rows
        } else if (typeof group._id === "string") {
          // Group by field
          groupByFields.push(group._id);
          selectFields.push(`${group._id} as _id`);
        }

        // Handle aggregation operations
        for (const [outputField, operation] of Object.entries(group)) {
          if (outputField === "_id") continue;
          
          if (operation.$sum) {
            const field = operation.$sum.replace("$", "");
            selectFields.push(`SUM(${field}) as ${outputField}`);
          } else if (operation.$avg) {
            const field = operation.$avg.replace("$", "");
            selectFields.push(`AVG(${field}) as ${outputField}`);
          } else if (operation.$count) {
            selectFields.push(`COUNT(*) as ${outputField}`);
          } else if (operation.$min) {
            const field = operation.$min.replace("$", "");
            selectFields.push(`MIN(${field}) as ${outputField}`);
          } else if (operation.$max) {
            const field = operation.$max.replace("$", "");
            selectFields.push(`MAX(${field}) as ${outputField}`);
          }
        }
      }
    }

    // Build SQL query
    let sql = `SELECT `;
    
    if (selectFields.length > 0) {
      sql += selectFields.join(", ");
    } else {
      // Default: sum totalAmount if no aggregation specified
      sql += `SUM(totalAmount) as total`;
    }
    
    sql += ` FROM ${this.tableName}`;
    
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(" AND ")}`;
    }

    if (groupByFields.length > 0) {
      sql += ` GROUP BY ${groupByFields.join(", ")}`;
    }

    // Execute query
    if (groupByFields.length > 0) {
      // Multiple rows possible
      const rows = db.prepare(sql).all(...params);
      return rows.map((row) => {
        const result = { ...row };
        // Ensure _id is present if grouping
        if (groupByFields.length > 0 && !result._id) {
          result._id = row[groupByFields[0]];
        }
        return result;
      });
    } else {
      // Single row result
      const row = db.prepare(sql).get(...params);
      if (row) {
        return [row];
      }
      // Return default empty result
      return selectFields.length > 0 
        ? [Object.fromEntries(selectFields.map(f => {
            const match = f.match(/as (\w+)/);
            return [match ? match[1] : 'total', 0];
          }))]
        : [{ total: 0 }];
    }
  }
}
