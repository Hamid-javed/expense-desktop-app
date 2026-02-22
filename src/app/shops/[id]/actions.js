"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectToDatabase, isMongoDB } from "../../../lib/db";
import { requireUserId } from "../../../lib/auth";
import { withUserId } from "../../../lib/tenant";
import { Sale } from "../../../models/Sale";
import { Product } from "../../../models/Product";
import { ReturnModel } from "../../../models/Return";

const createReturnSchema = z.object({
  saleId: z.string().min(1),
  itemIndex: z.coerce.number().int().min(0),
  quantity: z.coerce.number().min(0.0001),
  reason: z.string().optional(),
});

export async function createReturn(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();

    const raw = {
      saleId: formData.get("saleId")?.toString().trim(),
      itemIndex: formData.get("itemIndex")?.toString().trim(),
      quantity: formData.get("quantity")?.toString().trim(),
      reason: formData.get("reason")?.toString().trim() || undefined,
    };

    const parsed = createReturnSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const { saleId, itemIndex, quantity, reason } = parsed.data;

    const sale = await Sale.findOne(withUserId(userId, { _id: saleId }))
      .lean();
    if (!sale || sale.deletedAt) {
      return { error: "Sale not found" };
    }

    if (itemIndex >= (sale.items?.length ?? 0)) {
      return { error: "Invalid item index" };
    }

    const item = sale.items[itemIndex];
    const productId = item.productId?._id ?? item.productId;

    if (quantity > item.quantity) {
      return {
        error: `Return quantity (${quantity}) cannot exceed sold quantity (${item.quantity})`,
      };
    }

    const effectivePrice = item.price - (item.discount || 0);
    const returnAmount = quantity * effectivePrice;

    const returnData = {
      saleId: sale._id ?? sale.id,
      productId,
      quantity,
      reason: reason || undefined,
      ...(isMongoDB() && { userId }),
    };
    await ReturnModel.create(returnData);

    await Product.findOneAndUpdate(
      withUserId(userId, { _id: productId }),
      {
        $inc: {
          quantity: quantity,
          totalSold: -quantity,
          totalRevenue: -returnAmount,
        },
      }
    );

    const newItems = [...sale.items];
    if (quantity === item.quantity) {
      newItems.splice(itemIndex, 1);
    } else {
      const newQty = item.quantity - quantity;
      newItems[itemIndex] = {
        ...item,
        quantity: newQty,
        lineTotal: newQty * (item.price - (item.discount || 0)),
      };
    }

    const newTotalAmount = newItems.reduce((sum, it) => sum + (it.lineTotal || 0), 0);
    const newTotalDiscount = newItems.reduce((sum, it) => sum + (it.quantity * (it.discount || 0)), 0);
    const cashCollected = sale.cashCollected ?? 0;
    const newCashCollected = Math.min(cashCollected, newTotalAmount);
    const newCreditRemaining = newTotalAmount - newCashCollected;

    const saleIdVal = sale._id ?? sale.id;
    await Sale.findOneAndUpdate(
      withUserId(userId, { _id: saleIdVal }),
      {
        items: newItems,
        totalAmount: newTotalAmount,
        totalDiscount: newTotalDiscount,
        cashCollected: newCashCollected,
        creditRemaining: newCreditRemaining,
      }
    );

    const shopId = (sale.shopId?._id ?? sale.shopId)?.toString?.() ?? sale.shopId;
    revalidatePath(`/shops/${shopId}`);
    revalidatePath("/shops");
    revalidatePath("/sales");
    revalidatePath("/products");
    if (sale.staffId) {
      const staffId = (sale.staffId?._id ?? sale.staffId)?.toString?.() ?? sale.staffId;
      revalidatePath(`/staff/${staffId}/sales`);
    }

    return { success: true };
  } catch (err) {
    console.error("Create return error:", err);
    return { error: err?.message ?? "Failed to process return" };
  }
}
