"use client";

import { useState } from "react";
import { Button } from "../../components/ui/Button";

export function DownloadUnpaidInvoicesButton() {
  const [error, setError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setError(null);
    setIsDownloading(true);

    try {
      const response = await fetch("/api/reports/order-takers/unpaid-invoices");

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
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        className="h-8 px-3 text-xs"
        onClick={handleDownload}
        disabled={isDownloading}
      >
        {isDownloading ? "Downloading..." : "Download combined Report"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
