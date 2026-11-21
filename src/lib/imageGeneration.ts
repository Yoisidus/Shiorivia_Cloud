import { getServerLocalProvider } from "./localProviderServer";

type DrawRequest = { provider?:string; model?:string; description?:string; positive?:string;
 negative?:string; negativePrompt?:string; width?:number; height?:number; steps?:number;
 seed?:number; cfg?:number; byok?:unknown };
const text=(v:unknown,max=10000)=>typeof v==="string"?v.trim().slice(0,max):"";
const num=(v:unknown,fallback:number)=>typeof v==="number"&&Number.isFinite(v)?Math.max(256,Math.min(2048,Math.round(v))):fallback;
const json=async(r:Response)=>r.json().catch(()=>({}));
const limit=(v:string)=>{if(v.length>6*1024*1024)throw Error("Image too large for Cloud browser storage.");return v;};
const base64=(v:string)=>v.startsWith("data:image/")?v.slice(v.indexOf(",")+1):v;

export async function generateImage(payload:DrawRequest):Promise<{image:string;meta:Record<string,unknown>}>{
 const provider=text(payload.provider,50),model=text(payload.model,180);
 const description=text(payload.description),positive=text(payload.positive,4000);
 const negative=text(payload.negative||payload.negativePrompt,4000);
 if(!description||!model)throw Error("Image prompt and model ID are required.");
 if(provider==="comfyui"||!provider)throw Error("Local ComfyUI is unavailable in Cloud.");
 const config=getServerLocalProvider(provider,payload.byok);
 if(!config)throw Error("Cloud image provider is not configured or permitted.");
 const prompt=[positive,description].filter(Boolean).join(", ");
 const width=num(payload.width,768),height=num(payload.height,1024);
 const size=`${width}x${height}`;
 if(provider==="fal"){
   if(!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_./-]+$/.test(model)||model.includes(".."))throw Error("Invalid fal model path.");
   const res=await fetch("https://fal.run/"+model,{
     method:"POST",headers:{"Authorization":"Key "+config.apiKey,"Content-Type":"application/json"},
     body:JSON.stringify({prompt,negative_prompt:negative,image_size:{width,height}}),
     cache:"no-store",redirect:"error",signal:AbortSignal.timeout(90000),
   });
   const data=await json(res);
   if(!res.ok)throw Error("fal image request failed");
   const url=String(data.images?.[0]?.url||data.image?.url||"");
   if(!url.startsWith("https://"))throw Error("No image URL from fal.");
   const host=new URL(url).hostname;
   if(host!=="fal.media"&&!host.endsWith(".fal.media"))throw Error("Unexpected image host.");
   const result=await fetch(url,{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000)});
   if(!result.ok||Number(result.headers.get("content-length")||0)>4*1024*1024)throw Error("Image too large.");
   const binary=Buffer.from(await result.arrayBuffer());
   if(binary.length>4*1024*1024)throw Error("Image too large.");
   return {image:limit(binary.toString("base64")),meta:{provider,model}};
 }
 if(provider==="google"){
   if(!/^[a-zA-Z0-9_.-]+$/.test(model))throw Error("Invalid Google model ID.");
   const res=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent",{
     method:"POST",headers:{"x-goog-api-key":config.apiKey,"Content-Type":"application/json"},
     body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseModalities:["TEXT","IMAGE"]}}),
     redirect:"error",cache:"no-store",signal:AbortSignal.timeout(90000),
   });
   const data=await json(res);
   if(!res.ok)throw Error("Google image request failed.");
   const b=data.candidates?.[0]?.content?.parts?.find((p:any)=>p.inlineData?.data)?.inlineData?.data;
   if(typeof b!=="string")throw Error("Google did not return an image.");
   return {image:limit(base64(b)),meta:{provider,model}};
 }
 const base=config.baseURL;
 if(provider!=="openrouter"&&!config.custom)throw Error("Unsupported Cloud image provider.");
 const res=await fetch(base+(provider==="openrouter"?"/images":"/images/generations"),{
   method:"POST",headers:{"Authorization":"Bearer "+config.apiKey,"Content-Type":"application/json"},
   body:JSON.stringify({model,prompt,size,response_format:"b64_json"}),
   redirect:"error",cache:"no-store",signal:AbortSignal.timeout(90000),
 });
 const data=await json(res);
 if(!res.ok)throw Error("Image provider request failed.");
 const b=data.data?.[0]?.b64_json;
 if(typeof b!=="string")throw Error("Image provider did not return base64 data.");
 return {image:limit(base64(b)),meta:{provider,model}};
}
