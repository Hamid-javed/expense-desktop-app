import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../lib/db";
import { requireUserId } from "../../../../../lib/auth";
import { withUserId } from "../../../../../lib/tenant";
import { Sale } from "../../../../../models/Sale";
import { Shop } from "../../../../../models/Shop"; // Register Shop for Sale.populate("shopId")
import { OrderTaker } from "../../../../../models/OrderTaker"; // Register OrderTaker for Sale.populate("orderTakerId")
import { formatDatePK, getDaysExceeded, getTodayPK, getDateKeyPK } from "../../../../../lib/dateUtils";
import { INVOICE_PREFIX } from "../../../../../lib/config";
import ExcelJS from "exceljs";

export async function GET(req) {
  let userId;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const orderTakerId = searchParams.get("orderTakerId");

  // Build query for unpaid invoices (status=unpaid only; amount remaining is derived below)
  const baseQuery = { deletedAt: null, status: "unpaid" };
  if (orderTakerId) baseQuery.orderTakerId = orderTakerId;
  const query = withUserId(userId, baseQuery);

  // Fetch unpaid invoices
  const sales = await Sale.find(query)
    .populate("shopId", "name")
    .populate("orderTakerId", "name number")
    .sort({ date: 1 })
    .lean();

  // Unpaid = status unpaid AND amount still owed > 0
  const unpaidSales = sales.filter((sale) => {
    const total = sale.totalAmount ?? 0;
    const cash = sale.cashCollected ?? 0;
    const credit = sale.creditRemaining ?? 0;
    const amountRemaining = credit > 0 ? credit : total - cash;
    return sale.status === "unpaid" && amountRemaining > 0;
  });

  if (unpaidSales.length === 0) {
    return NextResponse.json(
      { error: "No unpaid invoices found" },
      { status: 404 }
    );
  }

  const todayStr = getTodayPK();

  // Prepare data rows
  const rows = unpaidSales.map((sale) => {
    const dateKey = getDateKeyPK(sale.date);
    const [year, month, day] = dateKey.split("-");
    const deliveryDate = `${month}/${day}/${year}`;
    const aging = getDaysExceeded(sale.date, todayStr);

    const totalAmount = sale.totalAmount ?? 0;
    const cashCollected = sale.cashCollected ?? 0;
    const amountRemaining = totalAmount - cashCollected;

    return {
      storeName: sale.shopId?.name || "-",
      orderTakerName: sale.orderTakerId?.name || "-",
      invoiceNumber: `${INVOICE_PREFIX}${sale.invoiceId}`,
      deliveryDate: deliveryDate,
      amountRemaining: amountRemaining,
      aging: aging,
    };
  });

  // Sort by aging (descending) then by store name
  rows.sort((a, b) => {
    if (b.aging !== a.aging) return b.aging - a.aging;
    return a.storeName.localeCompare(b.storeName);
  });

  const workbook = new ExcelJS.Workbook();
  const worksheetName =
    orderTakerId && rows.length > 0
      ? `Unpaid Invoices - ${rows[0].orderTakerName}`
      : "Unpaid Invoices";
  const worksheet = workbook.addWorksheet(worksheetName);

  worksheet.columns = [
    { width: 30 }, // Store Name
    { width: 20 }, // Order Taker
    { width: 18 }, // Invoice Number
    { width: 15 }, // Delivery Date
    { width: 18 }, // Amount Remaining
    { width: 10 }, // Aging
  ];

  const headerStyle = {
    font: { bold: true, color: { argb: "FFFFFFFF" } },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    },
    alignment: { horizontal: "left", vertical: "center" },
  };

  const agingRedStyle = {
    font: { bold: true, color: { argb: "FFFF0000" } },
    alignment: { horizontal: "center", vertical: "center" },
  };

  const agingNormalStyle = {
    font: { color: { argb: "FF000000" } },
    alignment: { horizontal: "center", vertical: "center" },
  };

  const totalStyle = {
    font: { bold: true, color: { argb: "FF000000" } },
  };

  const headerRow = worksheet.addRow([
    "Store Name",
    "Order Taker",
    "Invoice Number",
    "Delivery Date",
    "Amount Remaining",
    "Aging",
  ]);

  headerRow.eachCell((cell) => {
    cell.style = headerStyle;
  });

  rows.forEach((row) => {
    const dataRow = worksheet.addRow([
      row.storeName,
      row.orderTakerName,
      row.invoiceNumber,
      row.deliveryDate,
      row.amountRemaining,
      row.aging,
    ]);

    dataRow.getCell(5).numFmt = "#,##0";

    const agingCell = dataRow.getCell(6);
    agingCell.style = row.aging >= 8 ? agingRedStyle : agingNormalStyle;
  });

  const totalAmountRemaining = rows.reduce((sum, row) => sum + row.amountRemaining, 0);
  const totalRow = worksheet.addRow([
    "",
    "",
    "",
    "",
    totalAmountRemaining,
    "",
  ]);

  const totalAmountCell = totalRow.getCell(5);
  totalAmountCell.style = totalStyle;
  totalAmountCell.numFmt = "#,##0";

  const buffer = await workbook.xlsx.writeBuffer();

  let orderTakerNameForFile = "";
  if (orderTakerId && rows.length > 0) {
    orderTakerNameForFile = rows[0].orderTakerName.replace(/[^a-zA-Z0-9]/g, "-");
  }
  const filename = orderTakerId
    ? `unpaid-invoices-${orderTakerNameForFile}-${todayStr}.xlsx`
    : `unpaid-invoices-${todayStr}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
