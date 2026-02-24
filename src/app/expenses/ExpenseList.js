"use client";

import { Table, THead, TBody, TR, TH, TD } from "../../components/ui/Table";
import { formatDatePK } from "../../lib/dateUtils";

export function ExpenseList({ expenses, containerClassName }) {
    if (expenses.length === 0) {
        return (
            <div className="py-12 text-center text-slate-500">
                No expenses found for this period.
            </div>
        );
    }

    return (
        <Table containerClassName={containerClassName}>
            <THead>
                <TR>
                    <TH>Date</TH>
                    <TH>Category</TH>
                    <TH>Description</TH>
                    <TH>Saleman</TH>
                    <TH className="text-right">Amount</TH>
                </TR>
            </THead>
            <TBody>
                {expenses.map((exp) => (
                    <TR key={exp._id}>
                        <TD className="text-slate-600">
                            {formatDatePK(exp.date, { month: "short", day: "numeric", year: "numeric" })}
                        </TD>
                        <TD>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium 
                ${exp.category === "Fuel" ? "bg-blue-100 text-blue-800" :
                                    exp.category === "Food" ? "bg-orange-100 text-orange-800" :
                                        exp.category === "Salary" ? "bg-green-100 text-green-800" :
                                            exp.category === "Advance" ? "bg-purple-100 text-purple-800" :
                                                "bg-slate-100 text-slate-800"
                                }`}>
                                {exp.category}
                            </span>
                        </TD>
                        <TD className="max-w-xs truncate text-slate-700" title={exp.description}>
                            {exp.description || "-"}
                        </TD>
                        <TD>
                            {exp.salemanId?.name || "-"}
                        </TD>
                        <TD className="text-right font-medium text-slate-900">
                            {Number(exp.amount).toFixed(2)}
                        </TD>
                    </TR>
                ))}
            </TBody>
        </Table>
    );
}
