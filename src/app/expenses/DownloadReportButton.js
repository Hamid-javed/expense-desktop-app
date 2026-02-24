"use client";

import { generateExpenseReportPdf } from "../../lib/reports";
import { Button } from "../../components/ui/Button";

export function DownloadReportButton({ period, summary, productMetrics, expenses }) {
    const handleDownload = async () => {
        try {
            const bytes = await generateExpenseReportPdf({
                period,
                summary,
                productMetrics,
                expenses,
            });

            const blob = new Blob([bytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `Expense_Report_${period}_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("PDF Generation failed:", error);
            alert("Failed to generate PDF. Please try again.");
        }
    };

    return (
        <Button variant="outline" size="sm" onClick={handleDownload} className="h-8">
            <svg
                className="mr-2 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
            </svg>
            Download PDF
        </Button>
    );
}
