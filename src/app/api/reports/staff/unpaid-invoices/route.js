import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../lib/db";
import { Sale } from "../../../../../models/Sale";
import { Shop } from "../../../../../models/Shop";
import { Staff } from "../../../../../models/Staff";
import { formatDatePK, getDaysExceeded, getTodayPK, getDateKeyPK } from "../../../../../lib/dateUtils";
import { INVOICE_PREFIX } from "../../../../../lib/config";
import ExcelJS from "exceljs";

export async function GET(req) {
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get("staffId");

  // Build query for unpaid invoices
  const query = {
    deletedAt: null,
    $or: [
      { status: "unpaid" },
      { creditRemaining: { $gt: 0 } }
    ]
  };

  // Filter by staff if staffId is provided
  if (staffId) {
    query.staffId = staffId;
  }

  // Fetch unpaid invoices
  const sales = await Sale.find(query)
    .populate("shopId", "name")
    .populate("staffId", "name")
    .sort({ date: 1 })
    .lean();

  // Filter to only include sales with credit remaining > 0
  const unpaidSales = sales.filter(sale => (sale.creditRemaining ?? 0) > 0);

  if (unpaidSales.length === 0) {
    return NextResponse.json(
      { error: "No unpaid invoices found" },
      { status: 404 }
    );
  }

  const todayStr = getTodayPK();

  // Prepare data rows
  const rows = unpaidSales.map((sale) => {
    // Format date as MM/DD/YYYY to match the image format
    const dateKey = getDateKeyPK(sale.date);
    const [year, month, day] = dateKey.split('-');
    const deliveryDate = `${month}/${day}/${year}`;
    const aging = getDaysExceeded(sale.date, todayStr);
    
    return {
      storeName: sale.shopId?.name || "-",
      orderbookerName: sale.staffId?.name || "-",
      invoiceNumber: `${INVOICE_PREFIX}${sale.invoiceId}`,
      deliveryDate: deliveryDate,
      amountRemaining: sale.creditRemaining ?? 0,
      aging: aging,
    };
  });

  // Sort by aging (descending) then by store name
  rows.sort((a, b) => {
    if (b.aging !== a.aging) {
      return b.aging - a.aging;
    }
    return a.storeName.localeCompare(b.storeName);
  });

  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheetName = staffId && rows.length > 0 
    ? `Unpaid Invoices - ${rows[0].orderbookerName}`
    : "Unpaid Invoices";
  const worksheet = workbook.addWorksheet(worksheetName);

  // Set column widths
  worksheet.columns = [
    { width: 30 }, // Store Name
    { width: 20 }, // Orderbooker Name
    { width: 18 }, // Invoice Number
    { width: 15 }, // Delivery Date
    { width: 18 }, // Amount Remaining
    { width: 10 }, // Aging
  ];

  // Define styles
  const headerStyle = {
    font: { bold: true, color: { argb: "FFFFFFFF" } },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" }
    },
    alignment: { horizontal: "left", vertical: "center" }
  };

  const agingRedStyle = {
    font: { bold: true, color: { argb: "FFFF0000" } },
    alignment: { horizontal: "center", vertical: "center" }
  };

  const agingNormalStyle = {
    font: { color: { argb: "FF000000" } },
    alignment: { horizontal: "center", vertical: "center" }
  };

  const totalStyle = {
    font: { bold: true, color: { argb: "FF000000" } }
  };

  // Add header row
  const headerRow = worksheet.addRow([
    "Store Name",
    "Orderbooker Name",
    "Invoice Number",
    "Delivery Date",
    "Amount Remaining",
    "Aging"
  ]);

  // Apply header style
  headerRow.eachCell((cell) => {
    cell.style = headerStyle;
  });

  // Add data rows
  rows.forEach((row) => {
    const dataRow = worksheet.addRow([
      row.storeName,
      row.orderbookerName,
      row.invoiceNumber,
      row.deliveryDate,
      row.amountRemaining,
      row.aging
    ]);

    // Format amount remaining column (column 5, 1-indexed) - no forced decimals
    dataRow.getCell(5).numFmt = "#,##0";

    // Style aging column (column 6, 1-indexed): red and bold if >= 8 days
    const agingCell = dataRow.getCell(6);
    if (row.aging >= 8) {
      agingCell.style = agingRedStyle;
    } else {
      agingCell.style = agingNormalStyle;
    }
  });

  // Calculate and add total row
  const totalAmountRemaining = rows.reduce((sum, row) => sum + row.amountRemaining, 0);
  const totalRow = worksheet.addRow([
    "",
    "",
    "",
    "",
    totalAmountRemaining,
    ""
  ]);

  // Style total row
  const totalAmountCell = totalRow.getCell(5);
  totalAmountCell.style = totalStyle;
  totalAmountCell.numFmt = "#,##0";

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  // Get staff name for filename if filtering by staff
  let staffName = "";
  if (staffId && rows.length > 0) {
    staffName = rows[0].orderbookerName.replace(/[^a-zA-Z0-9]/g, "-");
  }
  const filename = staffId 
    ? `unpaid-invoices-${staffName}-${todayStr}.xlsx`
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
