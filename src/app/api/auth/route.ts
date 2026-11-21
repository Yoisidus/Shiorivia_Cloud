import { NextResponse } from "next/server";
// Destructive browser-only actions use typed confirmation; no shared server code.
export function POST(){return NextResponse.json({error:"Cloud server access codes are disabled"},{status:410});}
