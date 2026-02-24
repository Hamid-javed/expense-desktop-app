"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectToDatabase } from "../../lib/db";
import { requireUserId } from "../../lib/auth";
import { withUserId } from "../../lib/tenant";
import { Expense } from "../../models/Expense";
import { Purchase } from "../../models/Purchase";
import { Product } from "../../models/Product";
import { SalemanPayment } from "../../models/SalemanPayment";
import { parseDatePK } from "../../lib/dateUtils";

// --- Expenses ---

const expenseSchema = z.object({
    category: z.enum(["Fuel", "Food", "Salary", "Advance", "Shop Discount", "Other"]),
    description: z.string().optional(),
    amount: z.coerce.number().positive(),
    date: z.string(),
    salemanId: z.string().optional(),
});

export async function createExpense(formData) {
    try {
        const userId = await requireUserId();
        await connectToDatabase();

        const data = expenseSchema.parse({
            category: formData.get("category"),
            description: formData.get("description"),
            amount: formData.get("amount"),
            date: formData.get("date"),
            salemanId: formData.get("salemanId") || undefined,
        });

        await Expense.create({
            userId,
            ...data,
            date: parseDatePK(data.date),
        });

        revalidatePath("/expenses");
        return { success: true };
    } catch (error) {
        console.error("Error creating expense:", error);
        return { error: error.message || "Failed to create expense" };
    }
}

// --- Product Purchases (Stock In) ---

const purchaseSchema = z.object({
    productId: z.string().min(1),
    quantity: z.coerce.number().positive(),
    buyPrice: z.coerce.number().positive(),
    date: z.string(),
    supplier: z.string().optional(),
});

export async function recordPurchase(formData) {
    try {
        const userId = await requireUserId();
        await connectToDatabase();

        const data = purchaseSchema.parse({
            productId: formData.get("productId"),
            quantity: formData.get("quantity"),
            buyPrice: formData.get("buyPrice"),
            date: formData.get("date"),
            supplier: formData.get("supplier"),
        });

        const totalAmount = data.quantity * data.buyPrice;

        await Purchase.create({
            userId,
            ...data,
            totalAmount,
            date: parseDatePK(data.date),
        });

        // Update Product stock and current buyPrice
        await Product.findByIdAndUpdate(data.productId, {
            $inc: {
                quantity: data.quantity,
                totalBought: data.quantity
            },
            $set: { buyPrice: data.buyPrice }
        });

        revalidatePath("/products");
        revalidatePath("/expenses");
        return { success: true };
    } catch (error) {
        console.error("Error recording purchase:", error);
        return { error: error.message || "Failed to record purchase" };
    }
}

// --- Saleman Payments ---

const paymentSchema = z.object({
    salemanId: z.string().min(1),
    amount: z.coerce.number().positive(),
    date: z.string(),
    type: z.enum(["Salary", "Advance"]),
    month: z.string(), // "YYYY-MM"
    description: z.string().optional(),
});

export async function recordSalemanPayment(formData) {
    try {
        const userId = await requireUserId();
        await connectToDatabase();

        const data = paymentSchema.parse({
            salemanId: formData.get("salemanId"),
            amount: formData.get("amount"),
            date: formData.get("date"),
            type: formData.get("type"),
            month: formData.get("month"),
            description: formData.get("description"),
        });

        await SalemanPayment.create({
            userId,
            ...data,
            date: parseDatePK(data.date),
        });

        // Also record as an expense for the profit reports
        await Expense.create({
            userId,
            category: data.type, // "Salary" or "Advance"
            description: `${data.type} for ${data.month}: ${data.description || ""}`,
            amount: data.amount,
            date: parseDatePK(data.date),
            salemanId: data.salemanId,
        });

        revalidatePath("/saleman");
        revalidatePath("/expenses");
        return { success: true };
    } catch (error) {
        console.error("Error recording payment:", error);
        return { error: error.message || "Failed to record payment" };
    }
}
