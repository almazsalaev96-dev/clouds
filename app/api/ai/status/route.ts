import { NextResponse } from "next/server";
import { getProvider } from "@/ai";

/** Whether AI features can run. Never leaks the key or its shape. */
export async function GET() {
  const provider = getProvider();
  return NextResponse.json({ available: provider.available, provider: provider.name });
}
