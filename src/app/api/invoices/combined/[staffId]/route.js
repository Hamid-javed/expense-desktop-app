import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../lib/db";
import { requireUserId } from "../../../../../lib/auth";
import { withUserId } from "../../../../../lib/tenant";
import { Sale } from "../../../../../models/Sale";
import { Staff } from "../../../../../models/Staff";
import { RouteModel } from "../../../../../models/Route";
import { Shop } from "../../../../../models/Shop";
import { generateCombinedInvoicePdf } from "../../../../../lib/invoice";
import { getStartOfDayPK, getEndOfDayPK } from "../../../../../lib/dateUtils";

export async function GET(req, { params }) {
  let userId;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectToDatabase();
  const { staffId } = await params;
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");

  const staff = await Staff.findOne(withUserId(userId, { _id: staffId })).lean();
  if (!staff) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }

  const route = staff.routeId
    ? await RouteModel.findOne(withUserId(userId, { _id: staff.routeId })).lean()
    : null;

  if (!dateStr) {
    return NextResponse.json(
      { error: "Date is required for combined invoice" },
      { status: 400 }
    );
  }

  const startOfDay = getStartOfDayPK(dateStr);
  const endOfDay = getEndOfDayPK(dateStr);

  const sales = await Sale.find(
    withUserId(userId, {
      staffId,
      deletedAt: null,
      date: { $gte: startOfDay, $lte: endOfDay },
    })
  )
    .populate("shopId")
    .lean();

  // Group by shop and compute total per shop; collect invoice IDs per shop
  const shopMap = new Map();
  for (const sale of sales) {
    const shop = sale.shopId;
    if (!shop) continue;
    const id = shop._id?.toString() || shop.toString();
    const name = shop.name || "Unknown Shop";
    const phone = shop.phone || "";

    if (!shopMap.has(id)) {
      shopMap.set(id, {
        name,
        phone,
        invoiceIds: [],
        totalAmount: 0,
      });
    }
    const entry = shopMap.get(id);
    entry.totalAmount += sale.totalAmount || 0;
    if (sale.invoiceId != null) entry.invoiceIds.push(sale.invoiceId);
  }

  const shops = Array.from(shopMap.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount
  );

  if (shops.length === 0) {
    return NextResponse.json(
      { error: "No sales found for this staff on the selected date" },
      { status: 404 }
    );
  }

  const bytes = await generateCombinedInvoicePdf(shops, {
    staff,
    route,
    dateStr,
  });

  const filename = `combined-invoice-${staff.name}-${dateStr}.pdf`;

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
