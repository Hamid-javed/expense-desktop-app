import { SQLiteModel } from "./base.js";
import { SQLiteQuery } from "./QueryWrapper.js";

class ExpenseModel extends SQLiteModel {
    constructor() {
        super("expenses");
    }

    // Basic implementation, similar to other models
    find(query = {}) {
        const db = this.getDB();
        let sql = `SELECT * FROM ${this.tableName} WHERE deletedAt IS NULL`;
        const params = [];

        if (query.userId) {
            sql += ` AND userId = ?`;
            params.push(query.userId);
        }
        if (query.category) {
            sql += ` AND category = ?`;
            params.push(query.category);
        }
        if (query.salemanId) {
            sql += ` AND salemanId = ?`;
            params.push(query.salemanId);
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
            } else {
                const dateValue = query.date instanceof Date ? query.date.getTime() : query.date;
                sql += ` AND date = ?`;
                params.push(dateValue);
            }
        }

        const rows = db.prepare(sql).all(...params);
        const results = rows.map((row) => this.rowToObject(row));
        return new SQLiteQuery(this, query, results);
    }
}

export const Expense = new ExpenseModel();
