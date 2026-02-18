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
  staffId: z.string().min(1),
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
      })
    )
    .min(1),
});

async function getNextInvoiceNumber(userId) {
  if (isMongoDB()) {
    const counter = await InvoiceCounter.findOneAndUpdate(
      { userId, key: "invoice" },
      { $inc: { lastNumber: 1 } },
      { new: true, upsert: true }
    );
    return counter.lastNumber;
  }
  const counter = await InvoiceCounter.findOneAndUpdate(
    { key: "invoice" },
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
      if (!productId || !quantity) continue;
      rawItems.push({ productId, quantity, price });
    }

    const parsed = saleSchema.safeParse({
      date: formData.get("date")?.trim(),
      staffId: formData.get("staffId")?.trim(),
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

    // Check if a sale exists for the same shop, staff, and date
    const existingSale = await Sale.findOne(
      withUserId(userId, {
        shopId: data.shopId,
        staffId: data.staffId,
        date: { $gte: startOfDay, $lte: endOfDay },
        deletedAt: null,
      })
    ).lean();

    const itemsWithTotals = data.items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
      price: it.price,
      lineTotal: it.quantity * it.price,
    }));

    const newTotalAmount = itemsWithTotals.reduce(
      (sum, it) => sum + it.lineTotal,
      0
    );

    let sale;
    let invoiceId;
    let productUpdates = [];
    let creditUpdate = 0;

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
          existing.quantity += item.quantity;
          existing.lineTotal = existing.quantity * existing.price;
        } else {
          existingItemsMap.set(productIdStr, {
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
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
          const oldQuantity = existing.quantity;
          existing.quantity += newItem.quantity;
          existing.lineTotal = existing.quantity * existing.price;

          // Track product updates (only for the new quantity)
          productUpdates.push({
            productId: newItem.productId,
            quantityChange: newItem.quantity,
            revenueChange: newItem.lineTotal,
            oldQuantity: oldQuantity,
          });
        } else {
          // Different product: add as new item
          existingItemsMap.set(productIdStr, newItem);

          // Track product updates
          productUpdates.push({
            productId: newItem.productId,
            quantityChange: newItem.quantity,
            revenueChange: newItem.lineTotal,
            oldQuantity: 0,
          });
        }
      });

      // Convert map back to array
      const mergedItems = Array.from(existingItemsMap.values());
      const mergedTotalAmount = mergedItems.reduce(
        (sum, it) => sum + it.lineTotal,
        0
      );

      // Calculate credit update (only for new amount if payment type is credit)
      if (data.paymentType === "credit") {
        creditUpdate = newTotalAmount; // Add new credit amount
      }

      // Update existing sale: set cash/credit for merged total from new payment
      const newCash = data.paymentType === "cash" ? newTotalAmount : 0;
      const newCredit = data.paymentType === "credit" ? newTotalAmount : 0;
      
      // Get the sale ID (handle both MongoDB _id and SQLite id)
      const saleId = existingSale._id || existingSale.id;
      
      // Update the sale using SQLite-compatible method (include order taker from form)
      const saleFilter = isMongoDB() ? { _id: saleId, userId } : { _id: saleId };
      sale = await Sale.findOneAndUpdate(
        saleFilter,
        {
          items: mergedItems,
          totalAmount: mergedTotalAmount,
          cashCollected: (existingSale.cashCollected ?? 0) + newCash,
          creditRemaining: (existingSale.creditRemaining ?? 0) + newCredit,
          orderTakerId: data.orderTakerId,
          orderTakeDate,
        }
      );
    } else {
      // Create new sale
      invoiceId = await getNextInvoiceNumber(userId);

      // Always set to 0 by default - user can update via Cash & Credit form
      const cashCollected = 0;
      const creditRemaining = 0;
      const saleData = {
        invoiceId,
        date,
        staffId: data.staffId,
        shopId: data.shopId,
        orderTakerId: data.orderTakerId,
        orderTakeDate,
        items: itemsWithTotals,
        totalAmount: newTotalAmount,
        paymentType: data.paymentType,
        cashCollected,
        creditRemaining,
      };
      sale = await Sale.create(isMongoDB() ? { userId, ...saleData } : saleData);

      // Track all product updates for new sale
      productUpdates = itemsWithTotals.map((it) => ({
        productId: it.productId,
        quantityChange: it.quantity,
        revenueChange: it.lineTotal,
        oldQuantity: 0,
      }));

      // Calculate credit update
      if (data.paymentType === "credit") {
        creditUpdate = newTotalAmount;
      }
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
    revalidatePath(`/staff/${data.staffId}/sales`);
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
    const creditRemaining = Number(formData.get("creditRemaining"));

    if (!saleId) {
      return { error: "Missing sale id" };
    }
    if (Number.isNaN(cashCollected) || cashCollected < 0) {
      return { error: "Cash collected must be a non-negative number." };
    }
    if (Number.isNaN(creditRemaining) || creditRemaining < 0) {
      return { error: "Credit remaining must be a non-negative number." };
    }

    const sale = await Sale.findOne(
      withUserId(userId, { _id: saleId })
    ).lean();
    if (!sale || sale.deletedAt) {
      return { error: "Sale not found" };
    }

    const total = sale.totalAmount ?? 0;
    if (cashCollected + creditRemaining > total) {
      return {
        error: `Cash + credit (${(cashCollected + creditRemaining).toFixed(2)}) cannot exceed invoice total (${total.toFixed(2)}).`,
      };
    }

    const saleIdValue = sale._id || sale.id;
    const saleFilter = isMongoDB() ? { _id: saleIdValue, userId } : { _id: saleIdValue };
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
    
    const saleFilter = isMongoDB() ? { _id: saleIdValue, userId } : { _id: saleIdValue };
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

