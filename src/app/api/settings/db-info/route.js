import { NextResponse } from "next/server";
import { connectToDatabase, getDbType, getDbPath, isSQLite } from "../../../../lib/db/index.js";
import { getFriendlyConnectionMessage } from "../../../../lib/db/connectionError.js";

export async function GET() {
  try {
    await connectToDatabase();
    const dbType = getDbType();
    const dbPath = isSQLite() ? getDbPath() : null;
    return NextResponse.json({
      type: dbType,
      path: dbPath,
      isSQLite: isSQLite(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: getFriendlyConnectionMessage(err) },
      { status: 503 }
    );
  }
}
