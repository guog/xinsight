import { NextResponse } from "next/server"
import { logoutUser } from "@/lib/auth"

export async function POST() {
  await logoutUser()
  const response = NextResponse.json({ ok: true })
  response.cookies.delete("xinsight_session")
  return response
}
