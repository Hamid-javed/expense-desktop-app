"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase, isMongoDB } from "../../lib/db";
import { requireUserId } from "../../lib/auth";
import { withUserId } from "../../lib/tenant";
import { RouteModel } from "../../models/Route";
import { Saleman } from "../../models/Saleman";

export async function createRoute(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();
    const name = formData.get("name")?.trim();
    if (!name) {
      return { error: "Name is required" };
    }

    await RouteModel.create(isMongoDB() ? { userId, name } : { name });
    revalidatePath("/routes");
    return { success: true };
  } catch (error) {
    console.error("Error creating route:", error);
    return { error: error.message || "Failed to create route" };
  }
}

export async function updateRoute(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();
    const routeId = formData.get("id")?.trim();
    const name = formData.get("name")?.trim();

    if (!routeId) {
      return { error: "Missing route id" };
    }

    if (!name) {
      return { error: "Name is required" };
    }

    const route = await RouteModel.findOne(withUserId(userId, { _id: routeId })).lean();
    if (!route) {
      return { error: "Route not found" };
    }

    const routeIdValue = route._id || route.id;
    await RouteModel.findOneAndUpdate(withUserId(userId, { _id: routeIdValue }), { name });

    revalidatePath("/routes");
    revalidatePath("/saleman");
    return { success: true };
  } catch (error) {
    console.error("Error updating route:", error);
    return { error: error.message || "Failed to update route" };
  }
}

export async function deleteRoute(formData) {
  try {
    await connectToDatabase();
    const routeId = formData.get("id")?.trim();

    if (!routeId) {
      return { error: "Missing route id" };
    }

    const route = await RouteModel.findOne(withUserId(userId, { _id: routeId })).lean();
    if (!route) {
      return { error: "Route not found" };
    }

    const routeIdValue = route._id || route.id;
    const previousSalemanId = route.assignedSaleman?.toString();

    // Soft delete: set deletedAt and isActive
    await RouteModel.findOneAndUpdate(withUserId(userId, { _id: routeIdValue }), {
      deletedAt: Date.now(),
      isActive: false,
      assignedSaleman: null,
    });

    // Unassign saleman from this route
    if (previousSalemanId) {
      await Saleman.findOneAndUpdate(withUserId(userId, { _id: previousSalemanId }), { $unset: { routeId: "" } });
    }

    revalidatePath("/routes");
    revalidatePath("/saleman");
    return { success: true };
  } catch (error) {
    console.error("Error deleting route:", error);
    return { error: error.message || "Failed to delete route" };
  }
}

export async function assignSalemanToRoute(formData) {
  try {
    const userId = await requireUserId();
    await connectToDatabase();
    const routeId = formData.get("routeId")?.trim();
    const salemanId = formData.get("salemanId")?.trim();

    if (!routeId) {
      return { error: "Missing routeId" };
    }

    const route = await RouteModel.findOne(withUserId(userId, { _id: routeId })).lean();
    if (!route) {
      return { error: "Route not found" };
    }

    const routeIdValue = route._id || route.id;

    // Handle unassignment (empty salemanId)
    if (!salemanId) {
      // Unassign: clear the route's assignedSaleman and remove routeId from the previously assigned saleman
      const previousSalemanId = route.assignedSaleman?.toString();
      await RouteModel.findOneAndUpdate(withUserId(userId, { _id: routeIdValue }), {
        assignedSaleman: null,
      });

      if (previousSalemanId) {
        await Saleman.findOneAndUpdate(withUserId(userId, { _id: previousSalemanId }), { $unset: { routeId: "" } });
      }

      revalidatePath("/routes");
      revalidatePath("/saleman");
      return { success: true };
    }

    // Assign new saleman
    const saleman = await Saleman.findOne(withUserId(userId, { _id: salemanId }));
    if (!saleman) {
      return { error: "Saleman not found" };
    }

    // Check if this staff is already assigned to a different route
    const existingRoute = await RouteModel.findOne(
      withUserId(userId, { assignedStaff: staffId, _id: { $ne: routeId }, deletedAt: null })
    );

    if (existingRoute) {
      return {
        error: `This saleman is already assigned to route "${existingRoute.name}".`,
      };
    }

    // Unassign previous saleman if any on this route
    const previousSalemanId = route.assignedSaleman?.toString();
    if (previousSalemanId && previousSalemanId !== salemanId) {
      await Saleman.findOneAndUpdate(withUserId(userId, { _id: previousSalemanId }), { $unset: { routeId: "" } });
    }

    await RouteModel.findOneAndUpdate(withUserId(userId, { _id: routeIdValue }), {
      assignedSaleman: salemanId,
    });

    await Saleman.findOneAndUpdate(withUserId(userId, { _id: salemanId }), { routeId });

    revalidatePath("/routes");
    revalidatePath("/saleman");
    return { success: true };
  } catch (error) {
    console.error("Error assigning saleman to route:", error);
    return { error: error.message || "Failed to assign saleman to route" };
  }
}
