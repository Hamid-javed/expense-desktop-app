"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectToDatabase, isMongoDB } from "../../lib/db";
import { requireUserId } from "../../lib/auth";
import { withUserId } from "../../lib/tenant";
import { Product } from "../../models/Product";
import { Purchase } from "../../models/Purchase";
import { parseDatePK } from "../../lib/dateUtils";
import { UNITS } from "../../lib/config";

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  unit: z.enum(UNITS),
  buyPrice: z.coerce.number().nonnegative().default(0),
  price: z.coerce.number().nonnegative(),
  quantity: z.coerce.number().nonnegative().default(0),
});

export async function createProduct(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();

    const parsed = productSchema.safeParse({
      name: formData.get("name")?.trim(),
      sku: formData.get("sku")?.trim(),
      unit: formData.get("unit") || "pcs",
      price: formData.get("price"),
    });

    if (!parsed.success) {
      console.error(parsed.error.flatten());
      return { error: "Invalid product data" };
    }

    const data = parsed.data;

    const productData = {
      name: data.name,
      sku: data.sku,
      unit: data.unit,
      buyPrice: 0, // default
      price: data.price,
      quantity: 0, // default
      totalBought: 0, // default
    };
    await Product.create(isMongoDB() ? { userId, ...productData } : productData);

    revalidatePath("/products");
    return { success: true };
  } catch (error) {
    console.error("Error creating product:", error);
    return { error: error.message || "Failed to create product" };
  }
}

export async function updateProduct(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();

    const id = formData.get("id")?.trim();
    if (!id) {
      return { error: "Missing product id" };
    }

    const existingProduct = await Product.findOne(withUserId(userId, { _id: id })).lean();
    if (!existingProduct) {
      return { error: "Product not found" };
    }

    // Get all form values
    const name = formData.get("name")?.trim();
    const sku = formData.get("sku")?.trim();
    const unit = formData.get("unit");
    const price = formData.get("price");

    // Build update object
    const updateData = {};

    if (name) {
      updateData.name = name;
    }
    if (sku) {
      updateData.sku = sku;
    }
    if (unit) {
      updateData.unit = unit;
    }
    if (price !== null && price !== undefined && price !== "") {
      updateData.price = Number(price);
    }

    const parsed = productSchema.partial().safeParse(updateData);

    if (!parsed.success) {
      console.error("Validation error:", parsed.error.flatten());
      return { error: "Invalid product data" };
    }

    await Product.findOneAndUpdate(
      withUserId(userId, { _id: id }),
      parsed.data,
      { new: true }
    );

    revalidatePath("/products");
    return { success: true };
  } catch (error) {
    console.error("Error updating product:", error);
    return { error: error.message || "Failed to update product" };
  }
}

export async function toggleProductActive(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();
    const id = formData.get("id")?.trim();
    if (!id) {
      return { error: "Missing product id" };
    }

    const product = await Product.findOne(withUserId(userId, { _id: id })).lean();
    if (!product) {
      return { error: "Product not found" };
    }

    const productIdValue = product._id || product.id;
    await Product.findOneAndUpdate(withUserId(userId, { _id: productIdValue }), {
      isActive: !product.isActive,
    });

    revalidatePath("/products");
    return { success: true };
  } catch (error) {
    console.error("Error toggling product active:", error);
    return { error: error.message || "Failed to update product status" };
  }
}

