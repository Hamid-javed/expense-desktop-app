"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

export default function SettingsPage() {
  const [dbInfo, setDbInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState({ daily: false, monthly: false });

  useEffect(() => {
    fetch("/api/settings/db-info")
      .then((res) => res.json())
      .then((data) => {
        setDbInfo(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch DB info:", err);
        setLoading(false);
      });
  }, []);

  const handleExport = async (type) => {
    setExporting((prev) => ({ ...prev, [type]: true }));
    try {
      const response = await fetch(`/api/export?type=${type}`);
      if (!response.ok) {
        const error = await response.json();
        alert(`Export failed: ${error.error || "Unknown error"}`);
        return;
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `export_${type}_${Date.now()}.db`;

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert(`Export successful! File: ${filename}`);
    } catch (error) {
      console.error("Export error:", error);
      alert(`Export failed: ${error.message}`);
    } finally {
      setExporting((prev) => ({ ...prev, [type]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Database configuration and data export"
      />

      {/* <Card>
        <CardHeader title="Database Information" />
        <CardBody>
          {loading ? (
            <p className="text-slate-600">Loading...</p>
          ) : dbInfo ? (
            <div className="space-y-3">
              <div>
                <span className="font-medium text-slate-700">Database Type: </span>
                <span className="text-slate-900">{dbInfo.type.toUpperCase()}</span>
              </div>
              {dbInfo.path && (
                <div>
                  <span className="font-medium text-slate-700">Database Path: </span>
                  <span className="font-mono text-xs text-slate-600">{dbInfo.path}</span>
                </div>
              )}
              <div className="mt-4 text-xs text-slate-500">
                <p>
                  To change database type, set <code className="bg-slate-100 px-1 rounded">DB_TYPE</code> environment variable
                  to <code className="bg-slate-100 px-1 rounded">sqlite</code> or <code className="bg-slate-100 px-1 rounded">mongodb</code> in your .env file.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-red-600">Failed to load database information</p>
          )}
        </CardBody>
      </Card> */}

      <Card>
        <CardHeader title="Data Export" />
        <CardBody>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Export your database to a backup file. Daily exports include today&apos;s data,
              monthly exports include the current month&apos;s data.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => handleExport("daily")}
                disabled={exporting.daily || !dbInfo}
                variant="outline"
              >
                {exporting.daily ? "Exporting..." : "Export Daily Data"}
              </Button>
              <Button
                onClick={() => handleExport("monthly")}
                disabled={exporting.monthly || !dbInfo}
                variant="outline"
              >
                {exporting.monthly ? "Exporting..." : "Export Monthly Data"}
              </Button>
            </div>
            {dbInfo && !dbInfo.isSQLite && (
              <div className="mt-3 rounded-md bg-yellow-50 border border-yellow-200 p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Export is only available for SQLite databases.
                  Please switch to SQLite (set DB_TYPE=sqlite) to use export functionality.
                </p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
