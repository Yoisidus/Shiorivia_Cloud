import { NextResponse } from "next/server";
// Cloud never writes user media into a shared public filesystem.
export function POST(){return NextResponse.json({error:"Cloud media upload is disabled"},{status:410});}
