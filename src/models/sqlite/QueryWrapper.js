import { populateReferences } from "./populateHelper.js";

/**
 * Query wrapper for SQLite that mimics Mongoose query API
 */
export class SQLiteQuery {
  constructor(model, query, results) {
    this.model = model;
    this.query = query;
    this.results = results;
    this._populateFields = [];
    this._sortObj = null;
    this._limit = null;
  }

  /**
   * Populate references
   */
  populate(field, select) {
    if (typeof field === "string") {
      this._populateFields.push(field);
    } else if (Array.isArray(field)) {
      this._populateFields.push(...field);
    }
    return this;
  }

  /**
   * Sort results
   */
  sort(sortObj) {
    this._sortObj = sortObj;
    return this;
  }

  /**
   * Limit number of results
   */
  limit(count) {
    this._limit = count;
    return this;
  }

  /**
   * Return lean (plain) objects - already lean by default
   */
  lean() {
    return this;
  }

  /**
   * Execute query and return results
   */
  async exec() {
    return await this.execute();
  }

  /**
   * Execute query
   */
  async execute() {
    let results = this.results;

    // Apply sorting
    if (this._sortObj && Array.isArray(results)) {
      results = this.sortResults(results, this._sortObj);
    }

    // Apply limit
    if (this._limit !== null && Array.isArray(results)) {
      results = results.slice(0, this._limit);
    }

    // Apply population
    if (this._populateFields.length > 0 && results) {
      results = await populateReferences(results, this._populateFields);
    }

    return results;
  }

  /**
   * Make awaitable - execute when awaited
   */
  async then(resolve, reject) {
    try {
      const results = await this.execute();
      if (resolve) resolve(results);
      return results;
    } catch (error) {
      if (reject) reject(error);
      throw error;
    }
  }

  /**
   * Sort results array
   */
  sortResults(results, sortObj) {
    return [...results].sort((a, b) => {
      for (const [field, direction] of Object.entries(sortObj)) {
        const aVal = a[field];
        const bVal = b[field];
        if (aVal === bVal) continue;
        const comparison = aVal < bVal ? -1 : 1;
        return direction === -1 ? -comparison : comparison;
      }
      return 0;
    });
  }
}
