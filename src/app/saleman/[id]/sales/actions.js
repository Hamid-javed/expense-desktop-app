"use server";

import { connectToDatabase, isMongoDB } from "../../../../lib/db";
import { requireUserId } from "../../../../lib/auth";
import { withUserId } from "../../../../lib/tenant";
import { DailySalesSummary } from "../../../../models/DailySalesSummary";
import { Sale } from "../../../../models/Sale";
import { Product } from "../../../../models/Product";
import { Shop } from "../../../../models/Shop";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStartOfDayPK, getEndOfDayPK } from "../../../../lib/dateUtils";

const dailySummarySchema = z.object({
  salemanId: z.string().min(1),
  date: z.string().min(1), // YYYY-MM-DD
  cashSales: z.coerce.number().min(0).default(0),
  creditSales: z.coerce.number().min(0).default(0),
});

export async function upsertDailySalesSummary(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();

    const rawData = {
      salemanId: formData.get("salemanId")?.toString().trim(),
      date: formData.get("date")?.toString().trim(),
      cashSales: formData.get("cashSales")?.toString().trim() || "0",
      creditSales: formData.get("creditSales")?.toString().trim() || "0",
    };

    const validated = dailySummarySchema.parse(rawData);

    // Parse date string (YYYY-MM-DD) and create Date range in PK timezone
    const startOfDay = getStartOfDayPK(validated.date);
    const endOfDay = getEndOfDayPK(validated.date);

    // Calculate total sales amount for this saleman/date
    // Credit here means loans/credit given to shopkeepers, not credit sales
    // So we need to ensure cashSales + creditSales doesn't exceed total sales
    const sales = await Sale.find(
      withUserId(userId, {
        salemanId: validated.salemanId,
        deletedAt: null,
        date: { $gte: startOfDay, $lte: endOfDay },
      })
    ).lean();

    // Total sales amount (sum of all sales regardless of paymentType)
    const totalSalesAmount = sales.reduce(
      (sum, s) => sum + (s.totalAmount || 0),
      0
    );

    // Round to 2 decimals to avoid floating-point comparison issues
    const round2 = (n) => Math.round(Number(n) * 100) / 100;
    const cashEntered = round2(validated.cashSales);
    const creditEntered = round2(validated.creditSales);
    const totalEntered = round2(cashEntered + creditEntered);
    const totalActual = round2(totalSalesAmount);

    // Validate: cash + credit (loan) cannot exceed total sales amount
    if (totalEntered > totalActual) {
      return {
        success: false,
        error: `Daily cash + credit (loan) cannot exceed total sales amount (total sales: ${totalActual}).`,
      };
    }

    // Upsert: find or create, then update
    const summary = await DailySalesSummary.findOneAndUpdate(
      withUserId(userId, {
        salemanId: validated.salemanId,
        date: startOfDay,
        deletedAt: null,
      }),
      isMongoDB()
        ? {
          userId,
          salemanId: validated.salemanId,
          date: startOfDay,
          cashSales: validated.cashSales,
          creditSales: validated.creditSales,
          isActive: true,
          deletedAt: null,
        }
        : {
          salemanId: validated.salemanId,
          date: startOfDay,
          cashSales: validated.cashSales,
          creditSales: validated.creditSales,
          isActive: true,
          deletedAt: null,
        },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    // Revalidate the saleman sales page
    revalidatePath(`/saleman/${validated.salemanId}/sales`);

    return { success: true, data: summary };
  } catch (error) {
    console.error("Error upserting daily sales summary:", error);
    return {
      success: false,
      error:
        error instanceof z.ZodError
          ? error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
          : error.message || "Failed to save daily sales summary",
    };
  }
}

const updateSaleItemSchema = z.object({
  saleId: z.string().min(1),
  itemIndex: z.coerce.number().int().min(0),
  newQuantity: z.coerce.number().min(0),
});

export async function updateSaleItemQuantity(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();

    const rawData = {
      saleId: formData.get("saleId")?.toString().trim(),
      itemIndex: formData.get("itemIndex")?.toString().trim(),
      newQuantity: formData.get("newQuantity")?.toString().trim(),
    };

    const validated = updateSaleItemSchema.parse(rawData);

    // Fetch the sale
    const sale = await Sale.findOne(
      withUserId(userId, { _id: validated.saleId })
    ).lean();
    if (!sale || sale.deletedAt) {
      return { success: false, error: "Sale not found" };
    }

    if (validated.itemIndex >= sale.items.length) {
      return { success: false, error: "Invalid item index" };
    }

    const item = sale.items[validated.itemIndex];
    const oldQuantity = item.quantity;
    const quantityDiff = validated.newQuantity - oldQuantity;

    if (quantityDiff === 0) {
      return { success: true }; // No change
    }

    // Update the item
    item.quantity = validated.newQuantity;
    item.lineTotal = item.quantity * (item.price - (item.discount || 0));

    // Recalculate sale total and total discount
    sale.totalAmount = sale.items.reduce((sum, it) => sum + (it.lineTotal || 0), 0);
    sale.totalDiscount = sale.items.reduce((sum, it) => sum + (it.quantity * (it.discount || 0)), 0);

    // Update product quantity and stats
    const product = await Product.findOne(
      withUserId(userId, { _id: item.productId })
    );
    if (!product) {
      return { success: false, error: "Product not found" };
    }

    // Calculate changes
    const quantityChange = -quantityDiff; // Negative because we're reversing the sale effect
    const oldEffectivePrice = item.price - (item.discount || 0);
    const oldLineTotal = oldQuantity * oldEffectivePrice;
    const revenueChange = item.lineTotal - oldLineTotal;
    const oldSaleTotal = sale.totalAmount - revenueChange; // Sale total before update
    const saleTotalChange = sale.totalAmount - oldSaleTotal;

    // Update product
    await Product.findOneAndUpdate(
      withUserId(userId, { _id: item.productId }),
      {
        $inc: {
          quantity: quantityChange,
          totalSold: quantityDiff,
          totalRevenue: revenueChange,
        },
      }
    );

    // Note: currentCredit is now managed manually from the shop page only
    // Removed automatic currentCredit updates

    // Update the sale
    const saleIdValue = sale._id || sale.id;
    await Sale.findOneAndUpdate(
      withUserId(userId, { _id: saleIdValue }),
      { items: sale.items, totalAmount: sale.totalAmount, totalDiscount: sale.totalDiscount }
    );

    // Revalidate paths
    revalidatePath(`/saleman/${sale.salemanId}/sales`);
    revalidatePath("/sales");
    revalidatePath("/products");

    // Don't return the Mongoose document - it has circular references
    // Just return success without the data to avoid serialization issues
    return { success: true };
  } catch (error) {
    console.error("Error updating sale item quantity:", error);
    return {
      success: false,
      error:
        error instanceof z.ZodError
          ? error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
          : error.message || "Failed to update sale item quantity",
    };
  }
}
