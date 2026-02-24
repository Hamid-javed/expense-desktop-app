import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { requireUserId } from "../../../../lib/auth";
import { withUserId } from "../../../../lib/tenant";
import { Sale } from "../../../../models/Sale";
import { Shop } from "../../../../models/Shop";
import { Saleman } from "../../../../models/Saleman";
import { RouteModel } from "../../../../models/Route";
import { OrderTaker } from "../../../../models/OrderTaker";
import { generateInvoicePdf } from "../../../../lib/invoice";
import { INVOICE_PREFIX } from "../../../../lib/config";

export async function GET(req, { params }) {
  let userId;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectToDatabase();
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const fallbackOtName = searchParams.get("ot") || null;
  const fallbackOtDate = searchParams.get("date") || null;

  const sale = await Sale.findOne(withUserId(userId, { _id: id }))
    .populate("shopId")
    .populate("salemanId");
  if (!sale) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  }

  const shop = sale.shopId
    ? (await Shop.findOne(withUserId(userId, { _id: sale.shopId._id || sale.shopId })).lean())
    : null;
  const saleman = sale.salemanId
    ? (await Saleman.findOne(withUserId(userId, { _id: sale.salemanId._id || sale.salemanId })).lean())
    : null;
  const route = saleman?.routeId
    ? await RouteModel.findOne(withUserId(userId, { _id: saleman.routeId }))
    : null;

  // Load products for human-readable names
  const populatedSale = typeof sale?.toObject === "function" ? sale.toObject() : { ...sale };
  const { Product: ProductModel } = await import("../../../../models/Product.js");
  const populatedItems = [];
  for (const item of populatedSale.items) {
    const p = await ProductModel.findOne(withUserId(userId, { _id: item.productId }));
    populatedItems.push({
      ...item,
      product: p ? { name: p.name, sku: p.sku, unit: p.unit } : null,
    });
  }
  populatedSale.items = populatedItems;

  let otName = fallbackOtName;
  let otNumber = null;
  let otDate = fallbackOtDate;
  if (sale.orderTakerId) {
    const orderTaker = await OrderTaker.findOne(
      withUserId(userId, { _id: sale.orderTakerId })
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

  const bytes = await generateInvoicePdf(populatedSale, {
    shop,
    saleman,
    route,
    otName,
    otNumber,
    otDate,
  });

  const response = new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${INVOICE_PREFIX}${sale.invoiceId}.pdf"`,
    },
  });

  return response;
}

