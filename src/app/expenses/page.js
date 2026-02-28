import { connectToDatabase } from "../../lib/db";
import { requireUserId } from "../../lib/auth";
import { withUserId } from "../../lib/tenant";
import { serializeForClient } from "../../lib/serialize";
import { Sale } from "../../models/Sale";
import { Expense } from "../../models/Expense";
import { Purchase } from "../../models/Purchase";
import { Product } from "../../models/Product";
import { Saleman } from "../../models/Saleman";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { ProfitSummary } from "./ProfitSummary";
import { ExpenseForm } from "./ExpenseForm";
import { PurchaseForm } from "./PurchaseForm";
import { SalemanPaymentForm } from "./SalemanPaymentForm";
import { ExpenseList } from "./ExpenseList";
import { ProductProfitTable } from "./ProductProfitTable";
import { DownloadReportButton } from "./DownloadReportButton";
import {
    getStartOfWeekPK,
    getStartOfMonthPK,
    getEndOfDayPK,
    getTodayPK,
    getStartOfDayPK,
    getStartOfMonthFor,
    getEndOfMonthFor
} from "../../lib/dateUtils";
import { accumulateSalesMetrics, computeLineMetrics } from "../../lib/salesMetrics";
import {
    createExpense,
    recordPurchase,
    recordSalemanPayment
} from "./actions";
import Link from "next/link";
import { Button } from "../../components/ui/Button";
import { DateFilter } from "./DateFilter";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({ searchParams }) {
    const userId = await requireUserId();
    await connectToDatabase();

    const params = await searchParams;
    const period = params.period || "daily";
    const dateQuery = params.date || getTodayPK();
    const monthQuery = params.month || getTodayPK().substring(0, 7); // YYYY-MM
    const yearQuery = params.year || String(new Date().getFullYear());

    let startDate;
    let endDate = new Date(); // Default end is now

    if (period === "daily") {
        startDate = getStartOfDayPK(dateQuery);
        endDate = getEndOfDayPK(dateQuery);
    } else if (period === "weekly") {
        startDate = getStartOfWeekPK();
        // Keep endDate as now (last 7 days)
    } else if (period === "monthly") {
        startDate = getStartOfMonthFor(monthQuery);
        endDate = getEndOfMonthFor(monthQuery);
    } else if (period === "yearly") {
        startDate = new Date(Number(yearQuery), 0, 1, 0, 0, 0, 0);
        endDate = new Date(Number(yearQuery), 11, 31, 23, 59, 59, 999);
    } else {
        startDate = getStartOfMonthPK();
    }

    const dateRange = { $gte: startDate, $lte: endDate };

    // Fetch all necessary data for the period
    const [
        sales,
        expenses,
        purchases,
        products,
        salemen
    ] = await Promise.all([
        // Sales for calculating revenue and COGS
        Sale.find(withUserId(userId, {
            date: dateRange,
            deletedAt: null
        })).lean(),

        // Expenses
        Expense.find(withUserId(userId, {
            date: dateRange,
            deletedAt: null
        })).populate("salemanId", "name").sort({ date: -1 }).lean(),

        // Purchases (Stock in) for analyzing total bought quantity
        Purchase.find(withUserId(userId, {
            date: dateRange,
            deletedAt: null
        })).lean(),

        // Products for dropdowns
        Product.find(withUserId(userId, { deletedAt: null, isActive: true })).sort({ name: 1 }).lean(),

        // Salemen for dropdowns
        Saleman.find(withUserId(userId, { deletedAt: null, isActive: true })).sort({ name: 1 }).lean(),
    ]);

    // --- Aggregations ---

    // Initialize product metrics for tracking per-item performance
    const productMetrics = {};
    products.forEach(p => {
        productMetrics[p._id.toString()] = {
            name: p.name,
            sku: p.sku,
            purchased: 0,
            sold: 0,
            profit: 0,
            currentStock: p.quantity || 0,
            discount: 0,
        };
    });

    // Aggregate totals from sales
    const {
        grossRevenue: totalGrossRevenue,
        totalDiscount: totalDiscounts,
        netRevenue: totalNetRevenue,
        cogs: totalCOGS,
        quantity: totalSoldQty,
    } = accumulateSalesMetrics(sales);

    // Per-product metrics (net of discounts)
    sales.forEach(sale => {
        if (!Array.isArray(sale.items)) return;
        sale.items.forEach(item => {
            const pid = item.productId?.toString?.() ?? item.productId;
            const metrics = productMetrics[pid];
            if (!metrics) return;

            const {
                quantity,
                grossRevenue,
                discountAmount,
                cogs,
            } = computeLineMetrics(item);

            if (quantity <= 0) {
                return;
            }

            metrics.sold += quantity;
            metrics.discount += discountAmount;
            // Net profit per product = gross revenue - COGS - discounts
            metrics.profit += (grossRevenue - cogs - discountAmount);
        });
    });

    // Aggregate purchases for the period
    purchases.forEach(pur => {
        const pid = pur.productId.toString();
        if (productMetrics[pid]) {
            productMetrics[pid].purchased += (pur.quantity || 0);
        }
    });

    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalBoughtQty = purchases.reduce((sum, pur) => sum + (pur.quantity || 0), 0);

    // Serialize for client
    const serialExpenses = serializeForClient(expenses);
    const serialProducts = serializeForClient(products);
    const serialSalemen = serializeForClient(salemen);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Expenses & Profit"
                description="Track your expenditures, stock purchases, and final net profit."
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <DownloadReportButton
                            period={period}
                            summary={{
                                totalRevenue: totalGrossRevenue,
                                totalDiscounts,
                                totalCOGS,
                                totalExpenses,
                                totalBoughtQty,
                                totalSoldQty,
                            }}
                            productMetrics={productMetrics}
                            expenses={serialExpenses}
                        />
                        <DateFilter
                            currentPeriod={period}
                            currentDate={dateQuery}
                            currentMonth={monthQuery}
                            currentYear={yearQuery}
                        />
                    </div>
                }
            />

            {/* Summary Cards */}
            <ProfitSummary
                totalRevenue={totalGrossRevenue}
                totalDiscounts={totalDiscounts}
                totalCOGS={totalCOGS}
                totalExpenses={totalExpenses}
                totalSoldQty={totalSoldQty}
                totalBoughtQty={totalBoughtQty}
                period={period}
            />

            <div className="grid grid-cols-1 gap-6">
                {/* Forms Section */}
                <Card>
                    <CardHeader title="Record New Entry" />
                    <CardBody>
                        <div className="space-y-8">
                            <section>
                                <h3 className="mb-3 text-sm font-bold text-slate-800 uppercase tracking-tight">Record Expense</h3>
                                <ExpenseForm salemen={serialSalemen} createExpense={createExpense} />
                            </section>

                            <div className="border-t pt-6" />

                            <section>
                                <h3 className="mb-3 text-sm font-bold text-slate-800 uppercase tracking-tight">Stock In (Purchase)</h3>
                                <PurchaseForm products={serialProducts} recordPurchase={recordPurchase} />
                            </section>

                            <div className="border-t pt-6" />

                            <section>
                                <h3 className="mb-3 text-sm font-bold text-slate-800 uppercase tracking-tight">Saleman Payment (Salary/Advance)</h3>
                                <SalemanPaymentForm salemen={serialSalemen} recordSalemanPayment={recordSalemanPayment} />
                            </section>
                        </div>
                    </CardBody>
                </Card>

                {/* Product Performance Section */}
                <Card>
                    <CardHeader
                        title="Product Performance"
                        description={`Breakdown of sales, purchases, and profit for each item this ${period}.`}
                    />
                    <CardBody className="px-1">
                        <ProductProfitTable
                            metrics={productMetrics}
                            containerClassName=" max-h-[300px] overflow-y-auto"
                        />
                    </CardBody>
                </Card>

                {/* Expenses List */}
                <Card>
                    <CardHeader
                        title="Expenses Log"
                        description={`Showing all entries for the selected ${period} period.`}
                    />
                    <CardBody className="px-1">
                        <ExpenseList
                            expenses={serialExpenses}
                            containerClassName="max-h-[300px] overflow-y-auto"
                        />
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
