import { NextResponse } from "next/server";
import { connectToDatabase, getDbPath, isSQLite } from "../../../lib/db/index.js";
import fs from "fs";
import { getTodayPK } from "../../../lib/dateUtils.js";

export async function GET(req) {
  await connectToDatabase();

  if (!isSQLite()) {
    return NextResponse.json(
      { error: "Backup is only available for SQLite. Set DB_TYPE=sqlite in .env." },
      { status: 501 }
    );
  }

  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: "Database file not found." }, { status: 404 });
  }

  try {
    const today = getTodayPK();
    const filename = `expense_backup_${today}.db`;
    const dbBuffer = fs.readFileSync(dbPath);

    return new NextResponse(dbBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Backup error:", error);
    return NextResponse.json({ error: "Failed to create backup.", details: error.message }, { status: 500 });
  }
}
