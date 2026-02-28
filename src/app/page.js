import { connectToDatabase } from "../lib/db";
import { isOfflineError } from "../lib/db/connectionError.js";
import { requireUserId } from "../lib/auth";
import { withUserId, withUserIdForAggregate } from "../lib/tenant";
import { Sale } from "../models/Sale";
import "../models/Shop";
import "../models/Saleman";
import Link from "next/link";
import { PageHeader } from "../components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import {
  getTodayPK,
  getStartOfTodayPK,
  getStartOfMonthPK,
  getStartOfDayPK,
  getEndOfDayPK,
  formatDatePK,
  getStartOfMonthFor,
  getEndOfMonthFor,
  getDateKeyPK,
} from "../lib/dateUtils";
import { INVOICE_PREFIX } from "../lib/config";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }) {
  const [search, userId] = await Promise.all([
    searchParams,
    requireUserId(),
  ]);

  try {
    await connectToDatabase();
  } catch (err) {
    if (isOfflineError(err)) {
      return (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-6 text-center text-slate-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">{err.message}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Connect to the internet and refresh the page to load the dashboard.
          </p>
        </div>
      );
    }
    throw err;
  }

  const saleMatch = withUserIdForAggregate(userId, { deletedAt: null });
  const todayStr = getTodayPK();
  const period =
    search?.period === "monthly"
      ? "monthly"
      : search?.period === "all"
        ? "all"
        : "daily";
  const selectedDateStr =
    typeof search?.date === "string" && search.date.length > 0
      ? search.date
      : todayStr;
  const currentMonthStr = todayStr.slice(0, 7);
  const selectedMonthStr =
    typeof search?.month === "string" && search.month.length > 0
      ? search.month
      : currentMonthStr;

  const startOfToday = getStartOfTodayPK();
  const startOfMonth = getStartOfMonthPK();
  const startOfDay = getStartOfDayPK(selectedDateStr);
  const endOfDay = getEndOfDayPK(selectedDateStr);
  const monthStart = getStartOfMonthFor(selectedMonthStr);
  const monthEnd = getEndOfMonthFor(selectedMonthStr);

  const [
    totalSalesAgg,
    todaySalesAgg,
    monthSalesAgg,
    totalDiscountAgg,
    todayDiscountAgg,
    monthDiscountAgg,
    totalCashAgg,
    totalCreditAgg,
    filteredSales,
  ] = await Promise.all([
    // Net sales (after discount)
    Sale.aggregate([
      { $match: saleMatch },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Sale.aggregate([
      {
        $match: withUserIdForAggregate(userId, {
          date: { $gte: startOfDay, $lte: endOfDay },
          deletedAt: null,
        }),
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Sale.aggregate([
      {
        $match: withUserIdForAggregate(userId, {
          date: { $gte: monthStart, $lte: monthEnd },
          deletedAt: null,
        }),
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    // Discounts
    Sale.aggregate([
      { $match: saleMatch },
      { $group: { _id: null, total: { $sum: "$totalDiscount" } } },
    ]),
    Sale.aggregate([
      {
        $match: withUserIdForAggregate(userId, {
          date: { $gte: startOfDay, $lte: endOfDay },
          deletedAt: null,
        }),
      },
      { $group: { _id: null, total: { $sum: "$totalDiscount" } } },
    ]),
    Sale.aggregate([
      {
        $match: withUserIdForAggregate(userId, {
          date: { $gte: monthStart, $lte: monthEnd },
          deletedAt: null,
        }),
      },
      { $group: { _id: null, total: { $sum: "$totalDiscount" } } },
    ]),
    // Cash / credit summaries
    Sale.aggregate([
      { $match: saleMatch },
      { $group: { _id: null, total: { $sum: "$cashCollected" } } },
    ]),
    Sale.aggregate([
      { $match: saleMatch },
      { $group: { _id: null, total: { $sum: "$creditRemaining" } } },
    ]),
    // Listing data
    Sale.find(
      period === "all"
        ? saleMatch
        : withUserIdForAggregate(userId, {
          deletedAt: null,
          date:
            period === "daily"
              ? { $gte: startOfDay, $lte: endOfDay }
              : { $gte: monthStart, $lte: monthEnd },
        })
    )
      .populate("shopId", "name")
      .populate("salemanId", "name")
      .sort({ date: -1 })
      .lean(),
  ]);

  const totalSaleNet = totalSalesAgg[0]?.total || 0;
  const todaySaleNet = todaySalesAgg[0]?.total || 0;
  const monthlySaleNet = monthSalesAgg[0]?.total || 0;

  const totalSaleDiscount = totalDiscountAgg[0]?.total || 0;
  const todaySaleDiscount = todayDiscountAgg[0]?.total || 0;
  const monthlySaleDiscount = monthDiscountAgg[0]?.total || 0;

  const totalSale = totalSaleNet + totalSaleDiscount;
  const todaySale = todaySaleNet + todaySaleDiscount;
  const monthlySale = monthlySaleNet + monthlySaleDiscount;
  const totalCashCollected = totalCashAgg[0]?.total || 0;
  const totalOutstandingCredit = totalCreditAgg[0]?.total || 0;

  const formatAmount = (n) =>
    (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

  function getStatusDisplay(sale) {
    return { text: sale.status === "paid" ? "Paid" : "Unpaid" };
  }

  const monthLabel =
    period === "monthly"
      ? (() => {
        const [y, m] = selectedMonthStr.split("-").map(Number);
        const d = new Date(y, m - 1, 1);
        return formatDatePK(d, { month: "long", year: "numeric" });
      })()
      : null;
  const listingTitle =
    period === "all"
      ? "Sales Listing - All time"
      : period === "daily"
        ? `Sales Listing - ${selectedDateStr === todayStr ? "Today" : selectedDateStr}`
        : `Sales Listing - ${monthLabel}`;
  const exportHref =
    period === "daily"
      ? `/api/reports/sales?date=${encodeURIComponent(selectedDateStr)}`
      : `/api/reports/sales?month=${encodeURIComponent(selectedMonthStr)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Sales summaries and invoice listing."
        actions={
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Report period">
            <Link
              href="/?period=all"
              role="tab"
              aria-selected={period === "all"}
              aria-current={period === "all" ? "page" : undefined}
              className={period === "all" ? "inline-block ring-2 ring-slate-600 ring-offset-2 rounded-md" : undefined}
            >
              <Button
                type="button"
                variant={period === "all" ? "primary" : "outline"}
                className="h-8 px-3 text-xs font-semibold"
              >
                {period === "all" ? "All time ✓" : "All time"}
              </Button>
            </Link>
            <Link
              href={
                period === "daily"
                  ? `/?period=daily&date=${selectedDateStr}`
                  : `/?period=daily&date=${selectedMonthStr}-01`
              }
              role="tab"
              aria-selected={period === "daily"}
              aria-current={period === "daily" ? "page" : undefined}
              className={period === "daily" ? "inline-block ring-2 ring-slate-600 ring-offset-2 rounded-md" : undefined}
            >
              <Button
                type="button"
                variant={period === "daily" ? "primary" : "outline"}
                className="h-8 px-3 text-xs font-semibold"
              >
                {period === "daily" ? "Daily ✓" : "Daily"}
              </Button>
            </Link>
            <Link
              href={
                period === "monthly"
                  ? `/?period=monthly&month=${selectedMonthStr}`
                  : `/?period=monthly&month=${selectedDateStr.slice(0, 7)}`
              }
              role="tab"
              aria-selected={period === "monthly"}
              aria-current={period === "monthly" ? "page" : undefined}
              className={period === "monthly" ? "inline-block ring-2 ring-slate-600 ring-offset-2 rounded-md" : undefined}
            >
              <Button
                type="button"
                variant={period === "monthly" ? "primary" : "outline"}
                className="h-8 px-3 text-xs font-semibold"
              >
                {period === "monthly" ? "Monthly ✓" : "Monthly"}
              </Button>
            </Link>
            {period === "daily" ? (
              <form className="flex flex-wrap items-center gap-2" method="GET">
                <input type="hidden" name="period" value="daily" />
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <span>Date</span>
                  <input
                    type="date"
                    name="date"
                    defaultValue={selectedDateStr}
                    className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  />
                </label>
                <Button type="submit" variant="outline" className="h-8 px-3 text-xs">
                  Filter
                </Button>
              </form>
            ) : period === "monthly" ? (
              <form className="flex flex-wrap items-center gap-2" method="GET">
                <input type="hidden" name="period" value="monthly" />
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <span>Month</span>
                  <input
                    type="month"
                    name="month"
                    defaultValue={selectedMonthStr}
                    className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  />
                </label>
                <Button type="submit" variant="outline" className="h-8 px-3 text-xs">
                  Filter
                </Button>
              </form>
            ) : null}
            {period !== "all" && (
              <a
                href={exportHref}
                download
                className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
              >
                Export to Excel
              </a>
            )}
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader title="Total Sale" />
          <CardBody>
            <div className="text-xl font-semibold text-slate-900 sm:text-2xl">
              {formatAmount(totalSale)}
            </div>
            <p className="mt-1 text-xs text-slate-500">All time</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Monthly Sale" />
          <CardBody>
            <div className="text-xl font-semibold text-slate-900 sm:text-2xl">
              {formatAmount(monthlySale)}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {period === "monthly" ? monthLabel : "This month"}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Today Sale" />
          <CardBody>
            <div className="text-xl font-semibold text-slate-900 sm:text-2xl">
              {formatAmount(todaySale)}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {selectedDateStr === todayStr ? "Today" : selectedDateStr}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Total Cash Collected" />
          <CardBody>
            <div className="text-xl font-semibold text-slate-900 sm:text-2xl">
              {formatAmount(totalCashCollected)}
            </div>
            <p className="mt-1 text-xs text-slate-500">All shops</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Total Outstanding Credit" />
          <CardBody>
            <div className="text-xl font-semibold text-amber-700 sm:text-2xl">
              {formatAmount(totalOutstandingCredit)}
            </div>
            <p className="mt-1 text-xs text-slate-500">All shops</p>
          </CardBody>
        </Card>
      </div>

      {/* Sales Listing */}
      <Card>
        <CardHeader
          title={listingTitle}
          description={`${filteredSales.length} invoice${filteredSales.length !== 1 ? "s" : ""}`}
        />
        <CardBody>
          {filteredSales.length === 0 ? (
            <p className="py-8 text-center text-slate-500">
              {period === "all"
                ? "No sales found."
                : period === "daily"
                  ? "No sales found for this date."
                  : "No sales found for this month."}
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Invoice #</TH>
                  <TH>Date</TH>
                  <TH>Shop</TH>
                  <TH>Saleman</TH>
                  <TH className="text-right">Discount</TH>
                  <TH className="text-right">Amount</TH>
                  <TH className="text-right">Cash</TH>
                  <TH className="text-right">Credit</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {filteredSales.map((sale) => {
                  const statusDisplay = getStatusDisplay(sale);
                  const total = sale.totalAmount ?? 0;
                  const cash = sale.cashCollected ?? 0;
                  const remaining = Math.max(0, total - cash);
                  return (
                    <TR key={sale._id.toString()}>
                      <TD className="font-mono text-xs">
                        <Link
                          href={sale.shopId ? `/shops/${sale.shopId._id.toString()}?range=date&date=${getDateKeyPK(sale.date)}` : '#'}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {INVOICE_PREFIX}
                          {sale.invoiceId}
                        </Link>
                      </TD>
                      <TD className="text-slate-600">
                        {formatDatePK(sale.date, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TD>
                      <TD>{sale.shopId?.name || "-"}</TD>
                      <TD>{sale.salemanId?.name || "-"}</TD>
                      <TD className="text-right text-red-500 text-xs">
                        {formatAmount(sale.totalDiscount)}
                      </TD>
                      <TD className="text-right font-medium">
                        {formatAmount(sale.totalAmount)}
                      </TD>
                      <TD className="text-right text-slate-600">
                        {formatAmount(sale.cashCollected)}
                      </TD>
                      <TD className="text-right text-slate-600">
                        {formatAmount(remaining)}
                      </TD>
                      <TD>{statusDisplay.text}</TD>
                    </TR>
                  );
                })}
                {(() => {
                  const subtotal = filteredSales.reduce((sum, s) => sum + (s.totalAmount ?? 0), 0);
                  const collected = filteredSales.reduce((sum, s) => sum + (s.cashCollected ?? 0), 0);
                  const remaining = subtotal - collected;
                  const totalDiscount = filteredSales.reduce(
                    (sum, s) => sum + (s.totalDiscount ?? 0),
                    0
                  );
                  return (
                    <TR className="border-t-2 border-slate-200 bg-slate-50 font-semibold w-full">
                      <TD colSpan={4} className="text-left text-slate-700">
                        Subtotal
                      </TD>

                      <TD className="text-left text-slate-900">
                        {formatAmount(subtotal)}
                      </TD>
                      <TD className="text-right text-slate-700">
                        Collected:
                        {formatAmount(collected)}
                      </TD>
                      <TD className="text-right text-slate-700">
                        Remaining:
                        {formatAmount(Math.max(0, remaining))}
                      </TD>
                      <TD></TD>
                    </TR>
                  );
                })()}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
