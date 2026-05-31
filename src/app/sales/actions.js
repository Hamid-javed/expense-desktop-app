"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectToDatabase, isMongoDB } from "../../lib/db";
import { requireUserId } from "../../lib/auth";
import { withUserId } from "../../lib/tenant";
import { Sale } from "../../models/Sale";
import { InvoiceCounter } from "../../models/InvoiceCounter";
import { Shop } from "../../models/Shop";
import { Product } from "../../models/Product";
import { parseDatePK } from "../../lib/dateUtils";

const saleSchema = z.object({
  date: z.string(),
  salemanId: z.string().min(1),
  shopId: z.string().min(1),
  orderTakerId: z.string().min(1),
  orderTakeDate: z.string(),
  paymentType: z.enum(["cash", "credit"]),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().positive(),
        price: z.coerce.number().nonnegative(),
        discount: z.coerce.number().nonnegative().default(0),
      })
    )
    .min(1),
});

async function getNextInvoiceNumber(userId) {
  // Use user-namespaced key for SQLite so each user has their own counter sequence.
  // MongoDB uses userId field on the document instead.
  const key = isMongoDB() ? "invoice" : `${userId}:invoice`;
  const query = isMongoDB() ? { userId, key } : { key };
  const counter = await InvoiceCounter.findOneAndUpdate(
    query,
    { $inc: { lastNumber: 1 } },
    { new: true, upsert: true }
  );
  return counter.lastNumber;
}

export async function createSale(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();

    const rawItems = [];
    const itemCount = Number(formData.get("itemCount") || 0);

    for (let i = 0; i < itemCount; i += 1) {
      const productId = formData.get(`items[${i}][productId]`)?.trim();
      const quantity = formData.get(`items[${i}][quantity]`);
      const price = formData.get(`items[${i}][price]`);
      const discount = formData.get(`items[${i}][discount]`);
      if (!productId || !quantity) continue;
      rawItems.push({ productId, quantity, price, discount });
    }

    const parsed = saleSchema.safeParse({
      date: formData.get("date")?.trim(),
      salemanId: formData.get("salemanId")?.trim(),
      shopId: formData.get("shopId")?.trim(),
      orderTakerId: formData.get("orderTakerId")?.trim(),
      orderTakeDate: formData.get("orderTakeDate")?.trim() || formData.get("date")?.trim(),
      paymentType: formData.get("paymentType")?.trim(),
      items: rawItems,
    });

    if (!parsed.success) {
      console.error(parsed.error.flatten());
      return { error: "Invalid sale data. Please check all fields." };
    }

    const data = parsed.data;

    // Validate: no zero quantity, and requested quantity must not exceed available
    const productIds = [...new Set(data.items.map((it) => it.productId))];
    const products = await Product.find(withUserId(userId, { _id: { $in: productIds } })).lean();
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    for (const item of data.items) {
      if (item.quantity <= 0) {
        const p = productMap.get(item.productId);
        const name = p?.name || item.productId;
        return { error: `"${name}": quantity must be greater than zero.` };
      }
      const product = productMap.get(item.productId);
      if (!product) {
        return { error: "One or more products were not found." };
      }
      const available = product.quantity ?? 0;
      if (item.quantity > available) {
        return {
          error: `"${product.name}": only ${available} available (requested ${item.quantity}).`,
        };
      }
    }

    const date = parseDatePK(data.date);
    const orderTakeDate = parseDatePK(data.orderTakeDate);
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

    // Check if a sale exists for the same shop, saleman, and date
    const existingSale = await Sale.findOne(
      withUserId(userId, {
        shopId: data.shopId,
        salemanId: data.salemanId,
        date: { $gte: startOfDay, $lte: endOfDay },
        deletedAt: null,
      })
    ).lean();

    const itemsWithTotals = data.items.map((it) => {
      const product = productMap.get(it.productId);
      return {
        productId: it.productId,
        quantity: it.quantity,
        buyPrice: product?.buyPrice || 0, // Record purchase price at time of sale
        price: it.price,
        discount: it.discount,
        lineTotal: it.quantity * (it.price - it.discount),
      };
    });

    const newTotalDiscount = itemsWithTotals.reduce(
      (sum, it) => sum + (it.quantity * it.discount),
      0
    );

    const newTotalAmount = itemsWithTotals.reduce(
      (sum, it) => sum + it.lineTotal,
      0
    );

    let sale;
    let invoiceId;
    let productUpdates = [];

    if (existingSale) {
      // Merge with existing sale
      invoiceId = existingSale.invoiceId; // Keep original invoice ID

      // Create a map of existing items by productId
      const existingItemsMap = new Map();
      existingSale.items.forEach((item) => {
        const productIdStr = item.productId.toString();
        if (existingItemsMap.has(productIdStr)) {
          // If product already exists, merge quantities
          const existing = existingItemsMap.get(productIdStr);
          const oldQty = existing.quantity;
          const newQty = item.quantity;
          const total = oldQty + newQty;

          // Weighted averages so per-unit price/discount/buyPrice stay correct
          existing.discount =
            (oldQty * (existing.discount || 0) + newQty * (item.discount || 0)) / total;
          existing.price =
            (oldQty * (existing.price || 0) + newQty * (item.price || 0)) / total;
          existing.buyPrice =
            (oldQty * (existing.buyPrice || 0) + newQty * (item.buyPrice || 0)) / total;
          existing.quantity = total;
          existing.lineTotal = existing.quantity * (existing.price - existing.discount);
        } else {
          existingItemsMap.set(productIdStr, {
            productId: item.productId,
            quantity: item.quantity,
            buyPrice: item.buyPrice || 0, // Preserve cost basis for COGS
            price: item.price,
            discount: item.discount || 0,
            lineTotal: item.lineTotal,
          });
        }
      });

      // Merge new items with existing items
      itemsWithTotals.forEach((newItem) => {
        const productIdStr = newItem.productId.toString();
        if (existingItemsMap.has(productIdStr)) {
          // Same product: add quantities
          const existing = existingItemsMap.get(productIdStr);
          const oldQty = existing.quantity;
          const newQty = newItem.quantity;
          const total = oldQty + newQty;

          // Weighted averages so per-unit price/discount/buyPrice stay correct
          existing.discount =
            (oldQty * (existing.discount || 0) + newQty * (newItem.discount || 0)) / total;
          existing.price =
            (oldQty * (existing.price || 0) + newQty * (newItem.price || 0)) / total;
          existing.buyPrice =
            (oldQty * (existing.buyPrice || 0) + newQty * (newItem.buyPrice || 0)) / total;
          existing.quantity = total;
          existing.lineTotal = existing.quantity * (existing.price - existing.discount);

          // Track product updates (only for the new quantity)
          productUpdates.push({
            productId: newItem.productId,
            quantityChange: newItem.quantity,
            revenueChange: newItem.lineTotal,
          });
        } else {
          // Different product: add as new item
          existingItemsMap.set(productIdStr, newItem);

          // Track product updates
          productUpdates.push({
            productId: newItem.productId,
            quantityChange: newItem.quantity,
            revenueChange: newItem.lineTotal,
          });
        }
      });

      // Convert map back to array
      const mergedItems = Array.from(existingItemsMap.values());
      const mergedTotalDiscount = mergedItems.reduce(
        (sum, it) => sum + (it.quantity * (it.discount || 0)),
        0
      );
      const mergedTotalAmount = mergedItems.reduce(
        (sum, it) => sum + it.lineTotal,
        0
      );

      // Cash collected from this batch only (credit batches collect nothing now)
      const newCash = data.paymentType === "cash" ? newTotalAmount : 0;
      const mergedCash = (existingSale.cashCollected ?? 0) + newCash;
      // Credit is always derived: whatever of the merged total is not yet collected
      const mergedCredit = Math.max(0, mergedTotalAmount - mergedCash);

      // Get the sale ID (handle both MongoDB _id and SQLite id)
      const saleId = existingSale._id || existingSale.id;

      // Update the sale using SQLite-compatible method (include order taker from form)
      const saleFilter = { _id: saleId, userId };
      sale = await Sale.findOneAndUpdate(
        saleFilter,
        {
          items: mergedItems,
          totalDiscount: mergedTotalDiscount,
          totalAmount: mergedTotalAmount,
          cashCollected: mergedCash,
          creditRemaining: mergedCredit,
          orderTakerId: data.orderTakerId,
          orderTakeDate,
        }
      );
    } else {
      // Create new sale
      invoiceId = await getNextInvoiceNumber(userId);

      // Initialise from payment type: cash sales are fully collected,
      // credit sales are fully outstanding. Credit = total - cash always.
      const cashCollected = data.paymentType === "cash" ? newTotalAmount : 0;
      const creditRemaining = Math.max(0, newTotalAmount - cashCollected);
      const saleData = {
        invoiceId,
        date,
        salemanId: data.salemanId,
        shopId: data.shopId,
        orderTakerId: data.orderTakerId,
        orderTakeDate,
        items: itemsWithTotals,
        totalDiscount: newTotalDiscount,
        totalAmount: newTotalAmount,
        paymentType: data.paymentType,
        cashCollected,
        creditRemaining,
      };
      sale = await Sale.create({ userId, ...saleData });

      // Track all product updates for new sale
      productUpdates = itemsWithTotals.map((it) => ({
        productId: it.productId,
        quantityChange: it.quantity,
        revenueChange: it.lineTotal,
        oldQuantity: 0,
      }));
    }

    // Note: currentCredit is now managed manually from the shop page only
    // Removed automatic currentCredit updates

    // Update product quantities and stats (only for new quantities)
    await Promise.all(
      productUpdates.map((update) =>
        Product.findByIdAndUpdate(update.productId, {
          $inc: {
            totalSold: update.quantityChange,
            totalRevenue: update.revenueChange,
            quantity: -update.quantityChange, // Decrement stock quantity
          },
        })
      )
    );

    revalidatePath("/sales");
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/");
    revalidatePath(`/saleman/${data.salemanId}/sales`);
    revalidatePath(`/shops/${data.shopId}`);

    return { success: true, saleId: sale._id.toString(), invoiceId };
  } catch (error) {
    console.error("Error creating sale:", error);
    return { error: error.message || "Failed to create sale" };
  }
}

export async function updateSaleCashCredit(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();
    const saleId = formData.get("saleId")?.trim();
    const shopId = formData.get("shopId")?.trim();
    const cashCollected = Number(formData.get("cashCollected"));

    if (!saleId) {
      return { error: "Missing sale id" };
    }
    if (Number.isNaN(cashCollected) || cashCollected < 0) {
      return { error: "Cash collected must be a non-negative number." };
    }

    const sale = await Sale.findOne(
      withUserId(userId, { _id: saleId })
    ).lean();
    if (!sale || sale.deletedAt) {
      return { error: "Sale not found" };
    }

    const total = sale.totalAmount ?? 0;
    if (cashCollected > total) {
      return {
        error: `Cash collected (${cashCollected.toFixed(2)}) cannot exceed invoice total (${total.toFixed(2)}).`,
      };
    }

    // Credit is always the uncollected remainder of the invoice total.
    const creditRemaining = Math.max(0, total - cashCollected);

    const saleIdValue = sale._id || sale.id;
    const saleFilter = { _id: saleIdValue, userId };
    await Sale.findOneAndUpdate(saleFilter, {
      cashCollected,
      creditRemaining,
    });

    if (shopId) {
      revalidatePath(`/shops/${shopId}`);
    }
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error updating sale cash/credit:", error);
    return { error: error.message || "Failed to update cash/credit" };
  }
}

export async function toggleSaleStatus(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();
    const saleId = formData.get("saleId")?.trim();
    const shopId = formData.get("shopId")?.trim();
    if (!saleId) {
      return { error: "Missing sale id" };
    }

    const sale = await Sale.findOne(
      withUserId(userId, { _id: saleId })
    ).lean();
    if (!sale || sale.deletedAt) {
      return { error: "Sale not found" };
    }

    const saleIdValue = sale._id || sale.id;
    const isCurrentlyPaid = sale.status === "paid";
    const newStatus = isCurrentlyPaid ? "unpaid" : "paid";
    const totalAmount = sale.totalAmount ?? 0;

    // When marking as paid, set cashCollected to totalAmount and creditRemaining to 0
    // When marking as unpaid, set both cashCollected and creditRemaining to 0
    const updateData = {
      status: newStatus,
    };

    if (newStatus === "paid") {
      // Paid means all amount is given in cash
      updateData.cashCollected = totalAmount;
      updateData.creditRemaining = 0;
    } else {
      // Unpaid means reset both to 0
      updateData.cashCollected = 0;
      updateData.creditRemaining = 0;
    }

    const saleFilter = { _id: saleIdValue, userId };
    await Sale.findOneAndUpdate(saleFilter, updateData);

    if (shopId) {
      revalidatePath(`/shops/${shopId}`);
    } else {
      revalidatePath("/shops");
    }
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error toggling sale status:", error);
    return { error: error.message || "Failed to update sale status" };
  }
}

