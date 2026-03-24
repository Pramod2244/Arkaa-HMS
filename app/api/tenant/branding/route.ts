import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code || code.length < 2) {
    return NextResponse.json({ error: "Invalid tenant code" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findFirst({
    where: { code: code.toUpperCase(), isActive: true },
    select: { name: true, code: true },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json(
    { name: tenant.name, primaryColor: "#E8640A" },
    {
      status: 200,
      headers: { "Cache-Control": "public, max-age=300" },
    }
  );
}
