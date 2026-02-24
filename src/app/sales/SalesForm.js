"use client";

import { useState } from "react";
import { Table, THead, TBody, TR, TH, TD } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { PAYMENT_TYPES } from "../../lib/config";

export function SalesForm({ saleman, shops, products, orderTakers = [], createSale }) {
  const [rows, setRows] = useState([
    { productId: "", quantity: "", price: "", discount: "" },
  ]);
  const [paymentType, setPaymentType] = useState(PAYMENT_TYPES[0]);
  const [formError, setFormError] = useState(null);
  const [shopId, setShopId] = useState("");

  const shopOptions = (shops || []).map((s) => ({ id: s._id, label: s.name }));
  const productOptions = (products || []).map((p) => ({
    id: p._id,
    label: `${p.name} (${p.sku})`
  }));
  const defaultDate = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();

  const addRow = () => {
    setRows((prev) => [...prev, { productId: "", quantity: "", price: "", discount: "" }]);
  };

  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const onChangeRow = (index, field, value) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const computedRows = rows.map((row) => {
    const qty = Number(row.quantity || 0);
    const discount = Number(row.discount || 0);
    const price = Number(
      row.price ||
      (products.find((p) => p._id === row.productId)?.price ?? 0)
    );
    // Line total is quantity * (effective price)
    const effectivePrice = price - discount;
    return { ...row, quantity: row.quantity, price, discount, lineTotal: qty * effectivePrice };
  });

  const subtotal = computedRows.reduce(
    (sum, r) => {
      const qty = Number(r.quantity || 0);
      const price = Number(r.price || 0);
      return sum + (qty * price);
    },
    0
  );

  const totalDiscount = computedRows.reduce(
    (sum, r) => sum + (Number(r.quantity || 0) * (Number(r.discount) || 0)),
    0
  );

  const grandTotal = subtotal - totalDiscount;

  const getAvailable = (productId) => {
    const p = products.find((x) => x._id === productId);
    return p != null ? (p.quantity ?? 0) : null;
  };

  const getRowError = (row) => {
    if (!row.productId) return null;
    const qtyStr = String(row.quantity ?? "").trim();
    const qty = Number(qtyStr);
    // Only show "must be greater than zero" when user entered something invalid (0 or negative), not when field is empty
    if (qtyStr !== "" && (isNaN(qty) || qty <= 0)) {
      return "Quantity must be greater than zero.";
    }
    if (qtyStr !== "" && !isNaN(qty) && qty > 0) {
      const available = getAvailable(row.productId);
      if (available != null && qty > available) {
        return `Only ${available} available.`;
      }
    }
    return null;
  };

  const hasRowErrors = computedRows.some((row) => row.productId && getRowError(row));

  return (
    <form
      action={async (formData) => {
        setFormError(null);
        formData.set("paymentType", paymentType);
        formData.set("itemCount", String(computedRows.length));
        computedRows.forEach((row, index) => {
          formData.set(`items[${index}][productId]`, row.productId);
          formData.set(`items[${index}][quantity]`, String(row.quantity || 0));
          formData.set(`items[${index}][price]`, String(row.price || 0));
          formData.set(`items[${index}][discount]`, String(row.discount || 0));
        });

        const result = await createSale(formData);
        if (result?.error) {
          setFormError(result.error);
          return;
        }
        setRows([{ productId: "", quantity: "", price: "", discount: "" }]);
        setShopId("");
      }}
      className="space-y-4"
    >
      {formError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 md:grid-cols-4 md:text-sm">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          <span>Saleman</span>
          <select
            name="salemanId"
            required
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          >
            <option value="">Select saleman</option>
            {saleman.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <SearchableSelect
          label="Shop"
          name="shopId"
          placeholder="Select shop..."
          required
          options={shopOptions}
          value={shopId}
          onChange={(val) => setShopId(val)}
        />
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          <span>Date</span>
          <input
            type="date"
            name="date"
            required
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            defaultValue={defaultDate}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          <span>Order Taker (OT)</span>
          <select
            name="orderTakerId"
            required
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          >
            <option value="">Select order taker</option>
            {orderTakers.map((ot) => (
              <option key={ot._id} value={ot._id}>
                {ot.name} ({ot.number})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          <span>Order Take Date</span>
          <input
            type="date"
            name="orderTakeDate"
            required
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            defaultValue={defaultDate}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          <span>Payment type</span>
          <select
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          >
            {PAYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Product</TH>
            <TH className="text-right">Qty</TH>
            <TH className="text-right">Price</TH>
            <TH className="text-right">Discount</TH>
            <TH className="text-right">Line total</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {computedRows.map((row, index) => (
            <TR key={index}>
              <TD>
                <SearchableSelect
                  placeholder="Select product..."
                  options={productOptions}
                  value={row.productId}
                  onChange={(val) => onChangeRow(index, "productId", val)}
                  className="w-full"
                />
              </TD>
              <TD className="text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className={`h-8 w-20 rounded-md border px-2 text-right text-xs text-slate-900 shadow-sm outline-none focus:ring-1 focus:ring-slate-500 ${getRowError(row)
                      ? "border-red-500 focus:border-red-500"
                      : "border-slate-300 bg-white focus:border-slate-500"
                      }`}
                    value={row.quantity}
                    onChange={(e) =>
                      onChangeRow(index, "quantity", e.target.value)
                    }
                  />
                  {row.productId && (
                    <span className="text-[10px] text-slate-500">
                      Available: {getAvailable(row.productId) ?? 0}
                    </span>
                  )}
                  {getRowError(row) && (
                    <span className="text-[10px] text-red-600">
                      {getRowError(row)}
                    </span>
                  )}
                </div>
              </TD>
              <TD className="text-right">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-8 w-24 rounded-md border border-slate-300 bg-white px-2 text-right text-xs text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  value={row.price}
                  onChange={(e) =>
                    onChangeRow(index, "price", e.target.value)
                  }
                />
              </TD>
              <TD className="text-right">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-8 w-20 rounded-md border border-slate-300 bg-white px-2 text-right text-xs text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  placeholder="0.00"
                  value={row.discount}
                  onChange={(e) =>
                    onChangeRow(index, "discount", e.target.value)
                  }
                />
              </TD>
              <TD className="text-right">
                {Number(row.lineTotal || 0).toFixed(2)}
              </TD>
              <TD className="text-right">
                {index > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => removeRow(index)}
                  >
                    Remove
                  </Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <div className="flex items-center justify-between text-sm">
        <Button
          type="button"
          variant="outline"
          className="text-xs"
          onClick={addRow}
        >
          Add row
        </Button>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-600">
            Total items: {rows.length}
          </span>
          <div className="flex flex-col items-end gap-1">
            <div className="text-[10px] text-slate-500">
              Subtotal: {subtotal.toFixed(2)}
            </div>
            <div className="text-[10px] text-red-500">
              Discount: -{totalDiscount.toFixed(2)}
            </div>
            <div className="text-sm font-bold text-slate-900">
              Total: {grandTotal.toFixed(2)}
            </div>
          </div>
          <Button type="submit" disabled={hasRowErrors}>
            Save sale
          </Button>
        </div>
      </div>
    </form>
  );
}

