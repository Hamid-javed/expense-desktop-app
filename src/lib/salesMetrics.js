/**
 * Shared helpers for computing sales, discount, revenue, and COGS metrics
 * from Sale documents. These are intentionally framework-agnostic and work
 * with both MongoDB and SQLite models (plain JS objects / lean docs).
 */

/**
 * Compute metrics for a single sale line item.
 *
 * @param {Object} item
 * @param {number|string} item.quantity
 * @param {number|string} item.price          - per-unit sale price
 * @param {number|string} [item.discount]     - per-unit discount
 * @param {number|string} [item.buyPrice]     - per-unit cost price
 */
export function computeLineMetrics(item) {
  if (!item) {
    return {
      quantity: 0,
      grossRevenue: 0,
      discountAmount: 0,
      netRevenue: 0,
      cogs: 0,
    };
  }

  const quantity = Number(item.quantity || 0);
  const price = Number(item.price || 0);
  const discountPerUnit = Number(item.discount || 0);
  const buyPrice = Number(item.buyPrice || 0);

  if (!(quantity > 0)) {
    return {
      quantity: 0,
      grossRevenue: 0,
      discountAmount: 0,
      netRevenue: 0,
      cogs: 0,
    };
  }

  const grossRevenue = quantity * price;
  const discountAmount = quantity * discountPerUnit;
  const netRevenue = grossRevenue - discountAmount;
  const cogs = quantity * buyPrice;

  return {
    quantity,
    grossRevenue,
    discountAmount,
    netRevenue,
    cogs,
  };
}

/**
 * Aggregate metrics for a single Sale document.
 *
 * @param {Object} sale
 * @param {Array<Object>} [sale.items]
 */
export function accumulateSaleMetrics(sale) {
  let grossRevenue = 0;
  let totalDiscount = 0;
  let netRevenue = 0;
  let cogs = 0;
  let quantity = 0;

  if (!sale || !Array.isArray(sale.items)) {
    return { grossRevenue, totalDiscount, netRevenue, cogs, quantity };
  }

  for (const item of sale.items) {
    const metrics = computeLineMetrics(item);
    grossRevenue += metrics.grossRevenue;
    totalDiscount += metrics.discountAmount;
    netRevenue += metrics.netRevenue;
    cogs += metrics.cogs;
    quantity += metrics.quantity;
  }

  return { grossRevenue, totalDiscount, netRevenue, cogs, quantity };
}

/**
 * Aggregate metrics for an array of Sale documents.
 *
 * @param {Array<Object>} sales
 */
export function accumulateSalesMetrics(sales) {
  let grossRevenue = 0;
  let totalDiscount = 0;
  let netRevenue = 0;
  let cogs = 0;
  let quantity = 0;

  if (!Array.isArray(sales)) {
    return { grossRevenue, totalDiscount, netRevenue, cogs, quantity };
  }

  for (const sale of sales) {
    const metrics = accumulateSaleMetrics(sale);
    grossRevenue += metrics.grossRevenue;
    totalDiscount += metrics.totalDiscount;
    netRevenue += metrics.netRevenue;
    cogs += metrics.cogs;
    quantity += metrics.quantity;
  }

  return { grossRevenue, totalDiscount, netRevenue, cogs, quantity };
}

