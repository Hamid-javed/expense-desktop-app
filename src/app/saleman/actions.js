"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase, isMongoDB } from "../../lib/db";
import { requireUserId } from "../../lib/auth";
import { withUserId } from "../../lib/tenant";
import { Saleman as SalemanModel } from "../../models/Saleman";
import { RouteModel } from "../../models/Route";
import { z } from "zod";

/** Get form value, supporting prefixed keys from serialized forms */
function getFormValue(formData, key) {
  let val = formData.get(key);
  if (val != null && val !== "") return val;
  for (const [k, v] of formData.entries()) {
    if (k === key || k.endsWith("_" + key)) return v;
  }
  return null;
}

const salemanUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  cnic: z.string().optional(),
  routeId: z.string().optional(),
});

export async function createSaleman(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();

    const name = formData.get("name")?.trim();
    const phone = formData.get("phone")?.trim();
    const cnic = formData.get("cnic")?.trim();
    const routeId = formData.get("routeId")?.trim() || null;

    if (!name) {
      return { error: "Name is required" };
    }

    // simple 6-digit id; improve later to avoid collisions
    const salemanId = String(Math.floor(100000 + Math.random() * 900000));

    const salemanData = {
      name,
      phone: phone || undefined,
      cnic: cnic || undefined,
      routeId: routeId || undefined,
      salemanId,
    };
    const saleman = await SalemanModel.create(isMongoDB() ? { userId, ...salemanData } : salemanData);

    // If a route was selected during creation, keep route <-> saleman in sync
    if (routeId) {
      const routeFilter = withUserId(userId, { assignedSaleman: saleman._id, _id: { $ne: routeId } });
      await RouteModel.updateMany(routeFilter, { $unset: { assignedSaleman: "" } });

      const route = await RouteModel.findOne(withUserId(userId, { _id: routeId })).lean();
      if (route) {
        const previousSalemanId = route.assignedSaleman?.toString();
        const routeIdValue = route._id || route.id;
        await RouteModel.findOneAndUpdate(withUserId(userId, { _id: routeIdValue }), {
          assignedSaleman: saleman._id,
        });

        // If some other saleman previously owned this route, clear their routeId
        if (previousSalemanId && previousSalemanId !== saleman._id.toString()) {
          await SalemanModel.findOneAndUpdate(withUserId(userId, { _id: previousSalemanId }), {
            $unset: { routeId: "" },
          });
        }
      }

      revalidatePath("/routes");
    }

    revalidatePath("/saleman");
    return { success: true };
  } catch (error) {
    console.error("Error creating saleman:", error);
    return { error: error.message || "Failed to create saleman" };
  }
}

export async function updateSaleman(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();

    const rawData = {
      id: getFormValue(formData, "id")?.toString().trim(),
      name: getFormValue(formData, "name")?.toString().trim(),
      phone: getFormValue(formData, "phone")?.toString().trim() || "",
      cnic: getFormValue(formData, "cnic")?.toString().trim() || "",
      routeId: getFormValue(formData, "routeId")?.toString().trim() || "",
    };

    const validated = salemanUpdateSchema.parse(rawData);

    const saleman = await SalemanModel.findOne(withUserId(userId, { _id: validated.id }));
    if (!saleman || saleman.deletedAt) {
      return { error: "Saleman not found" };
    }

    const updateData = {};
    if (validated.name) updateData.name = validated.name;
    if (validated.phone !== undefined) updateData.phone = validated.phone || undefined;
    if (validated.cnic !== undefined) updateData.cnic = validated.cnic || undefined;
    if (validated.routeId !== undefined) updateData.routeId = validated.routeId || undefined;

    const newRouteId = validated.routeId ? validated.routeId : null;
    const oldRouteId = saleman.routeId?.toString() || null;
    const routeChanged = validated.routeId !== undefined && (newRouteId || "") !== (oldRouteId || "");

    await SalemanModel.findOneAndUpdate(withUserId(userId, { _id: validated.id }), updateData);

    // Sync route assignment when routeId changes
    if (routeChanged) {
      if (oldRouteId) {
        await RouteModel.findOneAndUpdate(withUserId(userId, { _id: oldRouteId }), { $unset: { assignedSaleman: "" } });
      }
      if (newRouteId) {
        await RouteModel.updateMany(
          withUserId(userId, { assignedSaleman: saleman._id, _id: { $ne: newRouteId } }),
          { $unset: { assignedSaleman: "" } }
        );
        const route = await RouteModel.findOne(withUserId(userId, { _id: newRouteId })).lean();
        if (route) {
          const previousSalemanId = route.assignedSaleman?.toString();
          const routeIdValue = route._id || route.id;
          await RouteModel.findOneAndUpdate(withUserId(userId, { _id: routeIdValue }), {
            assignedSaleman: saleman._id,
          });
          if (previousSalemanId && previousSalemanId !== saleman._id.toString()) {
            await SalemanModel.findOneAndUpdate(withUserId(userId, { _id: previousSalemanId }), { $unset: { routeId: "" } });
          }
        }
      }
      revalidatePath("/routes");
    }

    revalidatePath("/saleman");
    return { success: true };
  } catch (error) {
    console.error("Error updating saleman:", error);
    return {
      error: error instanceof z.ZodError
        ? error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
        : error.message || "Failed to update saleman",
    };
  }
}

export async function toggleSalemanActive(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();
    const id = formData.get("id")?.trim();
    if (!id) {
      return { error: "Missing id" };
    }

    const saleman = await SalemanModel.findOne(withUserId(userId, { _id: id })).lean();
    if (!saleman) {
      return { error: "Saleman not found" };
    }

    const salemanIdValue = saleman._id || saleman.id;
    await SalemanModel.findOneAndUpdate(withUserId(userId, { _id: salemanIdValue }), {
      isActive: !saleman.isActive,
    });

    revalidatePath("/saleman");
    return { success: true };
  } catch (error) {
    console.error("Error toggling saleman active:", error);
    return { error: error.message || "Failed to update saleman status" };
  }
}
