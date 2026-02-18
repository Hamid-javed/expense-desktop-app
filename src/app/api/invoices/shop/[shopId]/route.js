import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../lib/db";
import { requireUserId } from "../../../../../lib/auth";
import { withUserId } from "../../../../../lib/tenant";
import { Sale } from "../../../../../models/Sale";
import { Shop } from "../../../../../models/Shop";
import { Staff } from "../../../../../models/Staff";
import { RouteModel } from "../../../../../models/Route";
import { OrderTaker } from "../../../../../models/OrderTaker";
import { generateInvoicePdf, generateShopInvoicesListingPdf } from "../../../../../lib/invoice";
import { PDFDocument } from "pdf-lib";
import { getTodayPK, getStartOfDayPK, getEndOfDayPK } from "../../../../../lib/dateUtils";

export async function GET(req, { params }) {
  let userId;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectToDatabase();
  const { shopId } = await params;
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  const daysParam = searchParams.get("days");
  const fallbackOtName = searchParams.get("ot") || null;
  const fallbackOtDate = searchParams.get("otDate") || null;

  const shop = await Shop.findOne(withUserId(userId, { _id: shopId }));
  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  const query = withUserId(userId, { shopId, deletedAt: null });

  if (daysParam) {
    const days = parseInt(daysParam, 10) || 30;
    const today = getTodayPK();
    const endDate = getEndOfDayPK(today);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    query.date = { $gte: startDate, $lte: endDate };
  } else if (dateStr) {
    query.date = {
      $gte: getStartOfDayPK(dateStr),
      $lte: getEndOfDayPK(dateStr),
    };
  }

  const sales = await Sale.find(query)
    .populate("staffId")
    .populate("items.productId")
    .sort({ date: 1 })
    .lean();

  if (sales.length === 0) {
    return NextResponse.json(
      { error: "No sales found for this shop" },
      { status: 404 }
    );
  }

  const shopObj = shop.toObject ? shop.toObject() : shop;

  let bytes;

  if (daysParam) {
    // All time (last N days): single PDF with 1 header + 1 table listing all invoices
    const days = parseInt(daysParam, 10) || 30;
    const salesWithRefs = await Sale.find(query)
      .populate("staffId", "name staffId")
      .populate("orderTakerId", "name number")
      .sort({ date: 1 })
      .lean();
    bytes = await generateShopInvoicesListingPdf(shopObj, salesWithRefs, {
      dateRangeLabel: `Last ${days} days`,
    });
  } else {
    // Single date: one full invoice page per sale
    const mergedPdf = await PDFDocument.create();

    for (const sale of sales) {
      const staff = sale.staffId
        ? await Staff.findOne(withUserId(userId, { _id: sale.staffId._id || sale.staffId })).lean()
        : null;
      const route = staff?.routeId
        ? await RouteModel.findOne(withUserId(userId, { _id: staff.routeId })).lean()
        : null;

      let otName = fallbackOtName;
      let otDate = fallbackOtDate;
      let otNumber = null;
      if (sale.orderTakerId) {
        const orderTaker = await OrderTaker.findOne(
          withUserId(userId, { _id: sale.orderTakerId._id || sale.orderTakerId })
        ).lean();
        if (orderTaker) {
          otName = orderTaker.name || fallbackOtName;
          otNumber = orderTaker.number || null;
          if (sale.orderTakeDate) {
            const d = sale.orderTakeDate instanceof Date ? sale.orderTakeDate : new Date(sale.orderTakeDate);
            otDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          }
        }
      }

      const populatedSale = { ...sale };
      populatedSale.items = sale.items.map((item) => {
        const p = item.productId;
        return {
          ...item,
          product: p
            ? { name: p.name, sku: p.sku, unit: p.unit }
            : null,
        };
      });

      const salePdfBytes = await generateInvoicePdf(populatedSale, {
        shop: shopObj,
        staff,
        route,
        otName,
        otNumber,
        otDate,
      });

      const salePdf = await PDFDocument.load(salePdfBytes);
      const pages = await mergedPdf.copyPages(salePdf, salePdf.getPageIndices());
      pages.forEach((p) => mergedPdf.addPage(p));
    }

    bytes = await mergedPdf.save();
  }
  const filename = `shop-day-report-${shop.name}-${daysParam ? `last-${daysParam}-days` : dateStr || "all"}.pdf`;

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
