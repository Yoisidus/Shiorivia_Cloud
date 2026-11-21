import { NextResponse } from "next/server";
// Cloud IDE operates inside origin-scoped IndexedDB through browserIde.ts.
// Never expose the Local machine filesystem from a hosted server.
export const runtime="nodejs";
export function GET(){ return NextResponse.json({error:"Cloud IDE is browser-only"},{status:410}); }
export function POST(){ return NextResponse.json({error:"Cloud IDE is browser-only"},{status:410}); }
