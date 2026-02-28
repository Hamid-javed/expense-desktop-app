"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { SearchableSelect } from "../../components/ui/SearchableSelect";

export function PurchaseForm({ products, recordPurchase }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState("");

    // Format products for SearchableSelect
    const productOptions = products.map(p => ({
        id: p._id,
        label: `${p.name} (${p.sku})`
    }));

    async function handleSubmit(formData) {
        setLoading(true);
        // Ensure productId is set in formData if not already present
        if (!formData.get("productId") && selectedProductId) {
            formData.set("productId", selectedProductId);
        }

        const result = await recordPurchase(formData);
        setLoading(false);
        if (!result?.error) {
            setSelectedProductId(""); // Reset selection on success
            router.refresh();
        } else {
            alert(result.error);
        }
    }

    return (
        <form action={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SearchableSelect
                label="Product"
                name="productId"
                options={productOptions}
                value={selectedProductId}
                onChange={setSelectedProductId}
                placeholder="Search..."
                required
            />

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
