"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TR, TD } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";

function DownloadOrderTakerReportButton({ orderTakerId }) {
  const [error, setError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setError(null);
    setIsDownloading(true);

    try {
      const response = await fetch(`/api/reports/order-takers/unpaid-invoices?orderTakerId=${orderTakerId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "Failed to download report";
        setError(errorMessage);
        setIsDownloading(false);
        return;
      }

      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `unpaid-invoices-${Date.now()}.xlsx`;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setIsDownloading(false);
    } catch (err) {
      console.error("Download error:", err);
      setError("An error occurred while downloading the report. Please try again.");
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={handleDownload}
        disabled={isDownloading}
      >
        {isDownloading ? "..." : "Download Report"}
      </Button>
      {error && <span className="text-xs text-red-600 whitespace-nowrap">{error}</span>}
    </div>
  );
}

export function OrderTakerRow({ orderTaker, updateOrderTaker, deleteOrderTaker }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: orderTaker.name || "",
    number: orderTaker.number || "",
    cnic: orderTaker.cnic || "",
  });
  const [error, setError] = useState(null);

  async function handleUpdate(e) {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!formData.number.trim()) {
      setError("Number is required");
      return;
    }

    const data = new FormData();
    data.set("id", orderTaker._id);
    data.set("name", formData.name.trim());
    data.set("number", formData.number.trim());
    data.set("cnic", formData.cnic.trim());

    const result = await updateOrderTaker(data);
    if (result?.error) {
      setError(result.error);
    } else {
      setIsEditing(false);
      router.refresh();
    }
  }

  function handleCancel() {
    setFormData({
      name: orderTaker.name || "",
      number: orderTaker.number || "",
      cnic: orderTaker.cnic || "",
    });
    setIsEditing(false);
    setError(null);
  }

  async function handleDelete() {
    if (
      !confirm(
        `Are you sure you want to delete order taker "${orderTaker.name}"?`
      )
    ) {
      return;
    }

    const data = new FormData();
    data.set("id", orderTaker._id);
    const result = await deleteOrderTaker(data);
    if (result?.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <TR>
      <TD>
        {isEditing ? (
          <form onSubmit={handleUpdate} className="flex flex-col gap-2">
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Name"
              required
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            />
            <input
              type="text"
              value={formData.number}
              onChange={(e) =>
                setFormData({ ...formData, number: e.target.value })
              }
              placeholder="Number"
              required
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            />
            <input
              type="text"
              value={formData.cnic}
              onChange={(e) =>
                setFormData({ ...formData, cnic: e.target.value })
              }
              placeholder="CNIC (optional)"
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            />
            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}
            <div className="flex items-center gap-1">
              <Button
                type="submit"
                variant="outline"
                className="h-7 px-2 text-xs"
              >
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-800">{orderTaker.name}</span>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-slate-400 hover:text-slate-600 text-xs px-1.5 py-0.5 rounded hover:bg-slate-100"
              title="Edit"
            >
              ✏️
            </button>
          </div>
        )}
      </TD>
      <TD>{orderTaker.number || "-"}</TD>
      <TD>{orderTaker.cnic || "-"}</TD>
      <TD>
        {!isEditing && (
          <div className="flex items-center gap-2">
            <DownloadOrderTakerReportButton orderTakerId={orderTaker._id} />
            <Button
              variant="ghost"
              className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        )}
      </TD>
    </TR>
  );
}
