import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { COMPANY } from "./config";
import { formatDatePK } from "./dateUtils";

/**
 * Generate a comprehensive Expense & Profit Report PDF
 */
export async function generateExpenseReportPdf({
    period,
    summary,
    productMetrics,
    expenses,
}) {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const { width, height } = page.getSize();

    const margin = 50;
    const small = 8;
    const normal = 10;
    const heading = 16;
    const subHeading = 12;

    let y = height - margin;

    const draw = (text, x, yPos, size = normal, bold = false, color = rgb(0, 0, 0)) => {
        const f = bold ? fontBold : font;
        page.drawText(String(text ?? ""), {
            x,
            y: yPos,
            size,
            font: f,
            color,
        });
    };

    const drawLine = (x1, y1, x2, y2, thickness = 0.5) => {
        page.drawLine({
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
            thickness,
            color: rgb(0, 0, 0),
        });
    };

    const formatNum = (n) => (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // --- Header ---
    draw(COMPANY.name, margin, y, heading, true);
    y -= 18;
    const addr = [COMPANY.address, COMPANY.city].filter(Boolean).join(", ");
    if (addr) {
        draw(addr, margin, y, small);
        y -= 12;
    }
    draw(`Report Type: Expense & Profit Analysis (${period.toUpperCase()})`, margin, y, normal, true);
    const dateStr = formatDatePK(new Date(), { month: "long", day: "numeric", year: "numeric" });
    draw(`Generated: ${dateStr}`, width - margin - 150, y, small);
    y -= 10;
    drawLine(margin, y, width - margin, y, 1);
    y -= 25;

    // --- Financial Summary Section ---
    draw("FINANCIAL SUMMARY", margin, y, subHeading, true);
    y -= 15;
    const summaryWidth = (width - 2 * margin) / 2;

    const totalRevenue = summary.totalRevenue ?? 0;
    const totalDiscounts = summary.totalDiscounts ?? 0;
    const totalCOGS = summary.totalCOGS ?? 0;
    const totalExpenses = summary.totalExpenses ?? 0;
    const expensesAndDiscounts = totalExpenses + totalDiscounts;

    // Left Column
    let tempY = y;
    draw("Gross Revenue:", margin, tempY, normal, true);
    draw(formatNum(totalRevenue), margin + 140, tempY, normal);
    tempY -= 15;
    draw("Discounts:", margin, tempY, normal, true);
    draw(`- ${formatNum(totalDiscounts)}`, margin + 140, tempY, normal);
    tempY -= 15;
    draw("Net Revenue:", margin, tempY, normal, true);
    draw(formatNum(totalRevenue - totalDiscounts), margin + 140, tempY, normal, true);
    tempY -= 15;
    draw("Cost of Goods Sold (COGS):", margin, tempY, normal, true);
    draw(`- ${formatNum(totalCOGS)}`, margin + 140, tempY, normal);
    tempY -= 15;
    draw("Gross Profit (on base price):", margin, tempY, normal, true);
    draw(formatNum(totalRevenue - totalCOGS), margin + 140, tempY, normal, true);

    // Right Column
    tempY = y;
    draw("Total Expenses & Discounts:", margin + summaryWidth, tempY, normal, true, rgb(0.8, 0, 0));
    draw(`- ${formatNum(expensesAndDiscounts)}`, margin + summaryWidth + 160, tempY, normal);
    tempY -= 15;
    draw("Total Purchased Qty:", margin + summaryWidth, tempY, normal, true);
    draw(summary.totalBoughtQty.toString(), margin + summaryWidth + 160, tempY, normal);
    tempY -= 20;

    const netProfit = (totalRevenue - totalDiscounts) - totalCOGS - totalExpenses;
    const profitColor = netProfit >= 0 ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0);
    draw("NET PROFIT:", margin + summaryWidth, tempY, subHeading, true, profitColor);
    draw(formatNum(netProfit), margin + summaryWidth + 120, tempY, subHeading, true, profitColor);

    y = tempY - 30;
    drawLine(margin, y + 10, width - margin, y + 10, 0.5);

    // --- Product Performance Table ---
    draw("PRODUCT PERFORMANCE", margin, y, subHeading, true);
    y -= 15;

    const colW = [
        { w: 180, x: margin },       // Product
        { w: 70, x: margin + 180 },  // Purchased
        { w: 70, x: margin + 250 },  // Sold
        { w: 70, x: margin + 320 },  // Remaining
        { w: 80, x: margin + 390 },  // Profit
    ];

    const headers = ["Product / SKU", "Purchased", "Sold", "Remaining", "Profit"];
    headers.forEach((h, i) => draw(h, colW[i].x, y, 9, true));
    y -= 5;
    drawLine(margin, y, width - margin, y, 0.5);
    y -= 12;

    const metricsArray = Object.values(productMetrics)
        .filter(m => m.purchased > 0 || m.sold > 0)
        .sort((a, b) => b.profit - a.profit);

    for (const item of metricsArray) {
        if (y < 80) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = height - margin;
        }
        draw(`${item.name} (${item.sku})`.slice(0, 45), colW[0].x, y, 8);
        draw(item.purchased.toString(), colW[1].x, y, 8);
        draw(item.sold.toString(), colW[2].x, y, 8);
        draw(item.currentStock.toString(), colW[3].x, y, 8);
        draw(formatNum(item.profit), colW[4].x, y, 8, true, rgb(0, 0.4, 0));
        y -= 12;
    }

    y -= 25;
    if (y < 120) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - margin;
    }

    // --- Expense Log ---
    draw("EXPENSE LOG", margin, y, subHeading, true);
    y -= 15;

    const expColW = [
        { w: 80, x: margin },        // Date
        { w: 80, x: margin + 80 },   // Category
        { w: 220, x: margin + 160 }, // Description
        { w: 90, x: margin + 380 },  // Amount
    ];

    const expHeaders = ["Date", "Category", "Description", "Amount"];
    expHeaders.forEach((h, i) => draw(h, expColW[i].x, y, 9, true));
    y -= 5;
    drawLine(margin, y, width - margin, y, 0.5);
    y -= 12;

    for (const exp of expenses) {
        if (y < 60) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = height - margin;
            expHeaders.forEach((h, i) => draw(h, expColW[i].x, y, 8, true));
            y -= 12;
        }
        const d = formatDatePK(exp.date, { month: "short", day: "numeric", year: "numeric" });
        draw(d, expColW[0].x, y, 8);
        draw(exp.category, expColW[1].x, y, 8);
        draw((exp.description || "-").slice(0, 55), expColW[2].x, y, 8);
        draw(formatNum(exp.amount), expColW[3].x, y, 8, true);
        y -= 12;
    }

    const bytes = await pdfDoc.save();
    return bytes;
}
