"use client";

export function ShopDayReportPrompt({ shopId, reportDate, days, disabled = false }) {
  const handleClick = () => {
    const params = new URLSearchParams();
    if (days) {
      params.set("days", String(days));
    } else if (reportDate) {
      params.set("date", reportDate);
    }
    const url = `/api/invoices/shop/${shopId}?${params.toString()}`;
    window.open(url, "_blank");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`text-xs ${disabled ? "text-slate-400 cursor-not-allowed no-underline" : "text-slate-600 underline hover:text-slate-900"}`}
    >
      Download / Print Day Report
    </button>
  );
}
