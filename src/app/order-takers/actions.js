"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase, isMongoDB } from "../../lib/db";
import { requireUserId } from "../../lib/auth";
import { withUserId } from "../../lib/tenant";
import { OrderTaker } from "../../models/OrderTaker";

export async function createOrderTaker(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();
    const name = formData.get("name")?.trim();
    const number = formData.get("number")?.trim();
    const cnic = formData.get("cnic")?.trim() || null;

    if (!name) {
      return { error: "Name is required" };
    }
    if (!number) {
      return { error: "Number is required" };
    }

    const otData = { name, number, cnic: cnic || undefined };
    await OrderTaker.create(isMongoDB() ? { userId, ...otData } : otData);
    revalidatePath("/order-takers");
    revalidatePath("/sales");
    return { success: true };
  } catch (error) {
    console.error("Error creating order taker:", error);
    return { error: error.message || "Failed to create order taker" };
  }
}

export async function updateOrderTaker(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();
    const id = formData.get("id")?.trim();
    const name = formData.get("name")?.trim();
    const number = formData.get("number")?.trim();
    const cnic = formData.get("cnic")?.trim() || null;

    if (!id) {
      return { error: "Missing order taker id" };
    }
    if (!name) {
      return { error: "Name is required" };
    }
    if (!number) {
      return { error: "Number is required" };
    }

    const orderTaker = await OrderTaker.findOne(withUserId(userId, { _id: id })).lean();
    if (!orderTaker) {
      return { error: "Order taker not found" };
    }

    const idValue = orderTaker._id || orderTaker.id;
    await OrderTaker.findOneAndUpdate(withUserId(userId, { _id: idValue }), {
      name,
      number,
      cnic: cnic || undefined,
    });

    revalidatePath("/order-takers");
    revalidatePath("/sales");
    return { success: true };
  } catch (error) {
    console.error("Error updating order taker:", error);
    return { error: error.message || "Failed to update order taker" };
  }
}

export async function deleteOrderTaker(formData) {
  try {
    await connectToDatabase();
    const id = formData.get("id")?.trim();

    if (!id) {
      return { error: "Missing order taker id" };
    }

    const orderTaker = await OrderTaker.findOne(withUserId(userId, { _id: id })).lean();
    if (!orderTaker) {
      return { error: "Order taker not found" };
    }

    const idValue = orderTaker._id || orderTaker.id;
    await OrderTaker.findOneAndUpdate(withUserId(userId, { _id: idValue }), {
      deletedAt: Date.now(),
      isActive: false,
    });

    revalidatePath("/order-takers");
    revalidatePath("/sales");
    return { success: true };
  } catch (error) {
    console.error("Error deleting order taker:", error);
    return { error: error.message || "Failed to delete order taker" };
  }
}
