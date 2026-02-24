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
    getStartOfTodayPK,
    getStartOfWeekPK,
    getStartOfMonthPK,
    getEndOfDayPK,
    getTodayPK,
} from "../../lib/dateUtils";
import {
    createExpense,
    recordPurchase,
    recordSalemanPayment
} from "./actions";
import Link from "next/link";
import { Button } from "../../components/ui/Button";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({ searchParams }) {
    const userId = await requireUserId();
    await connectToDatabase();

    const period = (await searchParams)?.period || "daily";
    let startDate;
    const endDate = new Date(); // Current time

    if (period === "daily") {
        startDate = getStartOfTodayPK();
    } else if (period === "weekly") {
        startDate = getStartOfWeekPK();
    } else {
        startDate = getStartOfMonthPK();
    }

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
            date: { $gte: startDate },
            deletedAt: null
        })).lean(),

        // Expenses
        Expense.find(withUserId(userId, {
            date: { $gte: startDate },
            deletedAt: null
        })).populate("salemanId", "name").sort({ date: -1 }).lean(),

        // Purchases (Stock in) for analyzing total bought quantity
        Purchase.find(withUserId(userId, {
            date: { $gte: startDate },
            deletedAt: null
        })).lean(),

        // Products for dropdowns
        Product.find(withUserId(userId, { deletedAt: null, isActive: true })).sort({ name: 1 }).lean(),

        // Salemen for dropdowns
        Saleman.find(withUserId(userId, { deletedAt: null, isActive: true })).sort({ name: 1 }).lean(),
    ]);

    // --- Aggregations ---

    let totalGrossRevenue = 0;
    let totalCOGS = 0;
    let totalSoldQty = 0;
    let totalDiscounts = 0;

    // Initialize product metrics for tracking per-item performance
    const productMetrics = {};
    products.forEach(p => {
        productMetrics[p._id.toString()] = {
            name: p.name,
            sku: p.sku,
            purchased: 0,
            sold: 0,
            profit: 0,
            currentStock: p.quantity || 0
        };
    });

    sales.forEach(sale => {
        if (Array.isArray(sale.items)) {
            sale.items.forEach(item => {
                const qty = item.quantity || 0;
                const buyPrice = item.buyPrice || 0;
                const salePrice = item.price || 0;
                const discount = item.discount || 0;

                totalSoldQty += qty;
                const lineCOGS = qty * buyPrice;
                const lineGrossRevenue = qty * salePrice;
                const lineDiscount = qty * discount;

                totalCOGS += lineCOGS;
                totalGrossRevenue += lineGrossRevenue;
                totalDiscounts += lineDiscount;

                // Update per-product metrics
                const pid = item.productId.toString();
                if (productMetrics[pid]) {
                    productMetrics[pid].sold += qty;
                    // Profit = (Sale Price - Buy Price) * Qty
                    productMetrics[pid].profit += (lineGrossRevenue - lineCOGS);
                }
            });
        }
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

    // Final Net Profit = Gross Revenue - COGS - Expenses - Discounts
    // (Or Net Revenue - COGS - Expenses)
    // Here we use totalGrossRevenue, totalCOGS, and totalDiscounts as a separate expense
    const totalAllExpenses = totalExpenses + totalDiscounts;

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
                    <div className="flex gap-2">
                        <DownloadReportButton
                            period={period}
                            summary={{ totalRevenue: totalGrossRevenue, totalCOGS, totalExpenses: totalAllExpenses, totalBoughtQty, totalSoldQty }}
                            productMetrics={productMetrics}
                            expenses={serialExpenses}
                        />
                        <Link href="/expenses?period=daily">
                            <Button variant={period === "daily" ? "primary" : "outline"} className="h-8">Daily</Button>
                        </Link>
                        <Link href="/expenses?period=weekly">
                            <Button variant={period === "weekly" ? "primary" : "outline"} className="h-8">Weekly</Button>
                        </Link>
                        <Link href="/expenses?period=monthly">
                            <Button variant={period === "monthly" ? "primary" : "outline"} className="h-8">Monthly</Button>
                        </Link>
                    </div>
                }
            />

            {/* Summary Cards */}
            <ProfitSummary
                totalRevenue={totalGrossRevenue}
                totalCOGS={totalCOGS}
                totalExpenses={totalAllExpenses}
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
