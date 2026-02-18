"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "../../lib/db";
import { OrderTaker } from "../../models/OrderTaker";

export async function createOrderTaker(formData) {
  try {
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

    await OrderTaker.create({ name, number, cnic: cnic || undefined });
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

    const orderTaker = await OrderTaker.findById(id).lean();
    if (!orderTaker) {
      return { error: "Order taker not found" };
    }

    const idValue = orderTaker._id || orderTaker.id;
    await OrderTaker.findByIdAndUpdate(idValue, {
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

    const orderTaker = await OrderTaker.findById(id).lean();
    if (!orderTaker) {
      return { error: "Order taker not found" };
    }

    const idValue = orderTaker._id || orderTaker.id;
    await OrderTaker.findByIdAndUpdate(idValue, {
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
