import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCookieNames } from "@/lib/auth";

export async function POST(_request: NextRequest) {
  const { COOKIE_NAME, SUPER_ADMIN_COOKIE } = getCookieNames();
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(SUPER_ADMIN_COOKIE);
  return Response.json({ success: true });
}
