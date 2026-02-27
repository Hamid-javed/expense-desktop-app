"use client";

import { Card, CardBody, CardHeader } from "../../components/ui/Card";

export function ProfitSummary({
    totalRevenue,
    totalDiscounts = 0,
    totalCOGS,
    totalExpenses,
    totalBoughtQty,
    totalSoldQty,
    period
}) {
    const grossProfit = totalRevenue - totalCOGS;
    const netSales = totalRevenue - totalDiscounts;
    const netProfit = netSales - totalCOGS - totalExpenses;

    const format = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatQty = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

    const label = period === "monthly" ? "This Month" : period === "weekly" ? "This Week" : "Today";

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Sales & Revenue */}
            <Card className="border-l-4 border-l-blue-500">
                <CardHeader title="Revenue Overview" />
                <CardBody>
                    <div className="space-y-2">
                        <div className="flex justify-between border-b pb-1">
                            <span className="text-slate-500">Gross Sales:</span>
                            <span className="font-semibold text-slate-900">{format(totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                            <span className="text-slate-500">Discounts:</span>
                            <span className="font-semibold text-red-600">
                                -{format(totalDiscounts)}
                            </span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                            <span className="text-slate-500">Net Sales:</span>
                            <span className="font-semibold text-slate-900">
                                {format(netSales)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Sold Quantity:</span>
                            <span className="font-medium text-slate-700">{formatQty(totalSoldQty)}</span>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* COGS & Gross Profit */}
            <Card className="border-l-4 border-l-amber-500">
                <CardHeader title="Gross Profit" />
                <CardBody>
                    <div className="space-y-2">
                        <div className="flex justify-between border-b pb-1">
                            <span className="text-slate-500">COGS:</span>
                            <span className="text-slate-700">-{format(totalCOGS)}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                            <span className="text-slate-900 text-lg">Gross Profit:</span>
                            <span className="text-slate-900 text-lg">{format(grossProfit)}</span>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Expenses */}
            <Card className="border-l-4 border-l-red-500">
                <CardHeader title="Total Expenses" />
                <CardBody>
                    <div className="space-y-2">
                        <div className="flex justify-between border-b pb-1">
                            <span className="text-slate-500">Expenses:</span>
                            <span className="text-red-600 font-semibold">{format(totalExpenses)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Bought Qty:</span>
                            <span className="text-slate-700">{formatQty(totalBoughtQty)}</span>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Net Profit */}
            <Card className={`border-l-4 ${netProfit >= 0 ? "border-l-green-500" : "border-l-red-600"}`}>
                <CardHeader title="Net Profit (Final)" />
                <CardBody>
                    <div className="space-y-2">
                        <div className="text-center">
                            <div className={`text-3xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {format(netProfit)}
                            </div>
                            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{label} Result</p>
                        </div>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
