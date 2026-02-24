"use client";

import { Table, THead, TBody, TR, TH, TD } from "../../components/ui/Table";

export function ProductProfitTable({ metrics, containerClassName }) {
    const data = Object.values(metrics).filter(m => m.purchased > 0 || m.sold > 0);

    if (data.length === 0) {
        return (
            <div className="py-8 text-center text-slate-500 text-sm">
                No product activity (sales or purchases) in this period.
            </div>
        );
    }

    // Sort by profit descending
    const sortedData = [...data].sort((a, b) => b.profit - a.profit);

    return (
        <Table containerClassName={containerClassName}>
            <THead>
                <TR>
                    <TH>Product / SKU</TH>
                    <TH className="text-right">Purchased</TH>
                    <TH className="text-right">Sold</TH>
                    <TH className="text-right">Remaining</TH>
                    <TH className="text-right">Profit</TH>
                </TR>
            </THead>
            <TBody>
                {sortedData.map((item) => (
                    <TR key={item.sku}>
                        <TD>
                            <div className="font-medium text-slate-800">{item.name}</div>
                            <div className="text-xs text-slate-500">{item.sku}</div>
                        </TD>
                        <TD className="text-right text-blue-600 font-medium">
                            {item.purchased.toLocaleString()}
                        </TD>
                        <TD className="text-right text-orange-600 font-medium">
                            {item.sold.toLocaleString()}
                        </TD>
                        <TD className="text-right">
                            <span className={item.currentStock <= 5 ? "text-red-600 font-bold" : "text-slate-700 font-medium"}>
                                {item.currentStock.toLocaleString()}
                            </span>
                        </TD>
                        <TD className="text-right font-bold text-green-600">
                            {item.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TD>
                    </TR>
                ))}
            </TBody>
        </Table>
    );
}
