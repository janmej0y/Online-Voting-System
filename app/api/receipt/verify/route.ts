import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

const secret = process.env.JWT_SECRET;

export async function POST(request: Request) {
  if (!secret) {
    return NextResponse.json({ error: "JWT_SECRET is not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  if (!body?.token) {
    return NextResponse.json({ error: "Receipt token is required." }, { status: 400 });
  }

  const result = await jwtVerify(body.token, new TextEncoder().encode(secret)).catch(() => null);
  if (!result) {
    return NextResponse.json({ error: "Receipt token is invalid or expired." }, { status: 400 });
  }

  return NextResponse.json({
    valid: true,
    receipt: result.payload
  });
}
