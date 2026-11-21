import { NextResponse } from "next/server";
import { fallbackModelGroups } from "../../../lib/localProviders";
import { publicLocalProviders } from "../../../lib/localProviderServer";

// Cloud BYOK credentials are browser-origin-scoped and never live on the server.
// No credential query parameters and no default shared server API keys.
export const dynamic="force-dynamic";
export function GET(request:Request){
 const id=new URL(request.url).searchParams.get("models");
 const headers={"Cache-Control":"no-store"};
 if (!id)return NextResponse.json({providers:publicLocalProviders()},{headers});
 if (!/^(?:deepseek|openrouter|google|custom_[1-4])$/.test(id))
   return NextResponse.json({error:"Unknown provider"},{status:400,headers});
 return NextResponse.json({groups:fallbackModelGroups(id),source:"manual"},{headers});
}
