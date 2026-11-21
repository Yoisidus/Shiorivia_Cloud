import { NextResponse, type NextRequest } from "next/server";

/**
 * Cloud rebuild staging guard.
 * This branch copies Local code for engineering only; Local file, media,
 * Charta, IDE and provider endpoints are NOT public Cloud APIs.
 * Remove this guard only after Cloud-specific security and persistence work.
 */
export function proxy(_request: NextRequest) {
  return new NextResponse(
    "Shiorivia Cloud rebuild is not available for public use yet.",
    {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
