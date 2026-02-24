"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

export function PurchaseForm({ products, recordPurchase }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function handleSubmit(formData) {
        setLoading(true);
        const result = await recordPurchase(formData);
        setLoading(false);
        if (!result?.error) {
            router.refresh();
        } else {
            alert(result.error);
        }
    }

    return (
        <form action={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                <span>Product</span>
                <select
                    name="productId"
                    required
                    className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                >
                    <option value="">Select Product...</option>
                    {products.map((p) => (
                        <option key={p._id} value={p._id}>
                            {p.name} ({p.sku})
                        </option>
                    ))}
                </select>
            </label>

            <Input
                label="Quantity"
                name="quantity"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0"
            />

            <Input
                label="Buy Price (Unit)"
                name="buyPrice"
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

            <div className="flex items-end gap-2">
                <Input
                    label="Supplier (Optional)"
                    name="supplier"
                    placeholder="Vendor name"
                    className="flex-1"
                />
                <Button type="submit" disabled={loading}>
                    {loading ? "Recording..." : "Stock In"}
                </Button>
            </div>
        </form>
    );
}
