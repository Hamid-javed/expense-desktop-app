"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

export function SalemanPaymentForm({ salemen, recordSalemanPayment }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function handleSubmit(formData) {
        setLoading(true);
        const result = await recordSalemanPayment(formData);
        setLoading(false);
        if (!result?.error) {
            router.refresh();
        } else {
            alert(result.error);
        }
    }

    const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    return (
        <form action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 items-end">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                <span>Saleman</span>
                <select
                    name="salemanId"
                    required
                    className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                >
                    <option value="">Select Saleman...</option>
                    {salemen.map((s) => (
                        <option key={s._id} value={s._id}>
                            {s.name}
                        </option>
                    ))}
                </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                <span>Payment Type</span>
                <select
                    name="type"
                    required
                    className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                >
                    <option value="Salary">Salary</option>
                    <option value="Advance">Advance</option>
                </select>
            </label>

            <Input
                label="Amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
            />

            <Input
                label="Month"
                name="month"
                type="month"
                required
                defaultValue={currentMonth}
            />

            <Input
                label="Payment Date"
                name="date"
                type="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
            />

            <Input
                label="Notes"
                name="description"
                placeholder="Optional"
            />
            <Button type="submit" disabled={loading} className="w-full h-9">
                {loading ? "Paying..." : "Pay"}
            </Button>
        </form>
    );
}
