"use client";

import { useState } from "react";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

export default function SettingsPage() {
  const [backing, setBacking] = useState(false);

  const handleBackup = async () => {
    setBacking(true);
    try {
      const response = await fetch("/api/export");
      if (!response.ok) {
        const error = await response.json();
        alert(`Backup failed: ${error.error || "Unknown error"}`);
        return;
      }

      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `expense_backup_${Date.now()}.db`;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert(`Backup saved: ${filename}`);
    } catch (error) {
      console.error("Backup error:", error);
      alert(`Backup failed: ${error.message}`);
    } finally {
      setBacking(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Database backup and configuration"
      />

      <Card>
        <CardHeader title="Backup Database" />
        <CardBody>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Download a full backup of your database. Keep this file safe — you can restore it by replacing the database file on a new installation.
            </p>
            <Button onClick={handleBackup} disabled={backing}>
              {backing ? "Creating Backup..." : "Download Full Backup"}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
