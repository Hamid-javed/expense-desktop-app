import { NextResponse } from "next/server";
import { connectToDatabase, getDbType, getDbPath, isSQLite } from "../../../../lib/db/index.js";

export async function GET(req) {
  await connectToDatabase();

  const dbType = getDbType();
  const dbPath = isSQLite() ? getDbPath() : null;

  return NextResponse.json({
    type: dbType,
    path: dbPath,
    isSQLite: isSQLite(),
  });
}
