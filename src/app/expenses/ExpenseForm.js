"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

export function ExpenseForm({ salemen, createExpense }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function handleSubmit(formData) {
        setLoading(true);
        const result = await createExpense(formData);
        setLoading(false);
        if (!result?.error) {
            router.refresh();
            // Optionally reset form - simpler with standard form action though
        }
    }

    return (
        <form action={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                <span>Category</span>
                <select
                    name="category"
                    required
                    className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                >
                    <option value="Fuel">Fuel</option>
                    <option value="Food">Food</option>
                    <option value="Salary">Salary</option>
                    <option value="Advance">Advance</option>
                    <option value="Shop Discount">Shop Discount</option>
                    <option value="Other">Other</option>
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
                label="Date"
                name="date"
                type="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
            />

            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                <span>Saleman (Optional)</span>
                <select
                    name="salemanId"
                    className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                >
                    <option value="">None</option>
                    {salemen.map((s) => (
                        <option key={s._id} value={s._id}>
                            {s.name}
                        </option>
                    ))}
                </select>
            </label>

            <div className="flex items-end gap-2">
                <Input
                    label="Description"
                    name="description"
                    placeholder="Optional notes"
                    className="flex-1"
                />
                <Button type="submit" disabled={loading}>
                    {loading ? "Adding..." : "Add Expense"}
                </Button>
            </div>
        </form>
    );
}
