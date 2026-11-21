import { NextResponse } from "next/server";
import { generateImage } from "../../../lib/imageGeneration";
import { CloudRequestError, readCloudJson } from "../../../lib/cloudBody";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(req: Request) {
  try {
    const body = await readCloudJson(req, 128 * 1024);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const result = await generateImage(body);
    return NextResponse.json({ success: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof CloudRequestError ? e.message : "Image generation failed" }, { status: e instanceof CloudRequestError ? e.status : 502 });
  }
}
