import { NextResponse } from "next/server";
import { connectToDatabase, getDbPath, isSQLite, isMongoDB } from "../../../lib/db/index.js";
import fs from "fs";
import path from "path";
import { getTodayPK, getStartOfMonthPK, getEndOfMonthPK, getStartOfDayPK, getEndOfDayPK } from "../../../lib/dateUtils.js";

export async function GET(req) {
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "daily" or "monthly"

  if (!type || (type !== "daily" && type !== "monthly")) {
    return NextResponse.json(
      { error: "Type parameter must be 'daily' or 'monthly'" },
      { status: 400 }
    );
  }

  try {
    if (isSQLite()) {
      // SQLite: Copy database file
      const dbPath = getDbPath();
      
      if (!fs.existsSync(dbPath)) {
        return NextResponse.json(
          { error: "Database file not found" },
          { status: 404 }
        );
      }

      // Generate filename with timestamp
      const today = getTodayPK();
      let filename;
      if (type === "daily") {
        filename = `expense_app_daily_${today}.db`;
      } else {
        // Monthly
        const [year, month] = today.split("-");
        filename = `expense_app_monthly_${year}-${month}.db`;
      }

      // Read database file
      const dbBuffer = fs.readFileSync(dbPath);

      return new NextResponse(dbBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/x-sqlite3",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } else if (isMongoDB()) {
      // MongoDB: Export as JSON (or create SQLite dump)
      // For now, return error suggesting to use MongoDB export tools
      return NextResponse.json(
        { 
          error: "MongoDB export not yet implemented. Please use MongoDB export tools or switch to SQLite.",
          message: "To export data, set DB_TYPE=sqlite in your .env file"
        },
        { status: 501 }
      );
    } else {
      return NextResponse.json(
        { error: "Unknown database type" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export data", details: error.message },
      { status: 500 }
    );
  }
}
