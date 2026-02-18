"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createReturn } from "./actions";
import { Button } from "../../../components/ui/Button";

export function ReturnProductForm({ sale, shopId }) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const saleId = sale?._id?.toString?.() ?? sale?.id?.toString?.() ?? sale?._id ?? sale?.id;
  const allItems = sale?.items ?? [];
  const returnableItems = allItems
    .map((item, idx) => ({ item, originalIndex: idx }))
    .filter(({ item }) => (item?.quantity ?? 0) > 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const itemIndex = selectedItemIndex === "" ? -1 : parseInt(selectedItemIndex, 10);
    const qty = parseFloat(String(quantity).trim() || 0);

    if (!saleId) {
      setError("Invalid sale");
      setSubmitting(false);
      return;
    }
    if (itemIndex < 0 || itemIndex >= allItems.length || !returnableItems.some((r) => r.originalIndex === itemIndex)) {
      setError("Please select a product");
      setSubmitting(false);
      return;
    }

    const item = allItems[itemIndex];
    const maxQty = item?.quantity ?? 0;

    if (qty <= 0) {
      setError("Quantity must be greater than 0");
      setSubmitting(false);
      return;
    }
    if (qty > maxQty) {
      setError(`Quantity cannot exceed ${maxQty}`);
      setSubmitting(false);
      return;
    }

    const fd = new FormData();
    fd.set("saleId", saleId);
    fd.set("itemIndex", String(itemIndex));
    fd.set("quantity", String(qty));
    if (reason.trim()) fd.set("reason", reason.trim());

    const result = await createReturn(fd);
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setSelectedItemIndex("");
      setQuantity("");
      setReason("");
      router.refresh();
    }
  }

  if (returnableItems.length === 0) return null;

  const selectedEntry = returnableItems.find((r) => String(r.originalIndex) === selectedItemIndex);
  const selectedItem = selectedEntry?.item ?? null;
  const product = selectedItem?.productId;
  const productName = product?.name ?? "Unknown";
  const unit = product?.unit ?? "";
  const price = selectedItem?.price ?? 0;
  const lineTotal = selectedItem?.lineTotal ?? price * (selectedItem?.quantity ?? 0);
  const maxQty = selectedItem?.quantity ?? 0;

  return (
    <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h4 className="mb-3 text-sm font-medium text-slate-800">Return product</h4>
      {error && (
        <p className="mb-3 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-xs font-medium text-slate-700">
          Select product to return:
          <select
            value={selectedItemIndex}
            onChange={(e) => {
              setSelectedItemIndex(e.target.value);
              setQuantity("");
              setError(null);
            }}
            className="ml-2 mt-1 block rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
          >
            <option value="">-- Choose product --</option>
            {returnableItems.map(({ item, originalIndex }) => {
              const p = item.productId;
              const name = p?.name ?? "Unknown";
              const u = p?.unit ?? "";
              return (
                <option key={originalIndex} value={originalIndex}>
                  {name} (sold: {item.quantity} {u})
                </option>
              );
            })}
          </select>
        </label>

        {selectedItem && (
          <div className="flex flex-wrap items-center gap-2 rounded border border-amber-100 bg-white p-2">
            <span className="min-w-[120px] text-sm text-slate-700">{productName}</span>
            <span className="text-xs text-slate-500">
              sold: {maxQty} {unit} × {typeof price === "number" ? price.toFixed(2) : price} = {typeof lineTotal === "number" ? lineTotal.toFixed(2) : lineTotal}
            </span>
            <input
              type="number"
              name="quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min={0.0001}
              max={maxQty}
              step="any"
              placeholder="Qty to return"
              className="h-7 w-24 rounded border border-slate-300 px-2 text-sm"
            />
            <span className="text-xs text-slate-500">{unit}</span>
            <Button
              type="submit"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={!quantity || parseFloat(quantity) <= 0 || submitting}
            >
              {submitting ? "Processing..." : "Return"}
            </Button>
          </div>
        )}

        {selectedItem && (
          <label className="block text-xs text-slate-600">
            Reason (optional):
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. defective, wrong item"
              className="ml-0 mt-1 w-full max-w-xs rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
        )}
      </form>
    </div>
  );
}
