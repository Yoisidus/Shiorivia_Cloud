import { NextResponse } from "next/server";
// Cloud provider keys belong to each browser, never shared server environment.
export function GET(){return NextResponse.json({hasOpenRouter:false,hasGoogle:false,hasComfy:false,hasFal:false,hasSdUrl:false,hasTtsUrl:false,hasMusic:false},{headers:{"Cache-Control":"no-store"}});}
