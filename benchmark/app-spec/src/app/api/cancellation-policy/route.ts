import { NextResponse } from "next/server";
import { getCancellationPolicyTiers } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";

export async function GET() {
  seedIfEmpty();
  const tiers = getCancellationPolicyTiers();
  return NextResponse.json(tiers);
}
