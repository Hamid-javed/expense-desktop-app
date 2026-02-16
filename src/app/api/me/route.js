import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../lib/db";
import { getSession } from "../../../lib/auth";
import { User } from "../../../models/User";

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findById(session.userId)
    .select("name email")
    .lean();

  if (!user) {
    return NextResponse.json({ user: null }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      name: user.name || user.email,
      email: user.email,
    },
  });
}
