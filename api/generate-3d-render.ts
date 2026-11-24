import { consumeRateLimit, getClientIp } from "../src/server/rate-limit.js";
import { getAIRateLimit } from "../src/server/ai-limits.js";
type Request = { method?: string; headers?: Record<string, string | string[] | undefined>; body?: unknown; socket?: { remoteAddress?: string } };
const FALLBACKS: Record<string,string> = {
  "suprema-2":"/renders-3d/suprema-2.svg","suprema-4":"/renders-3d/suprema-4.svg",
  "gold-3":"/renders-3d/gold-3.svg","gold-fold":"/renders-3d/gold-fold.svg",
  "suprema-maxim":"/renders-3d/suprema-maxim.svg","gold-4":"/renders-3d/gold-4.svg",
};
const fallbackFor = (description:string) => /camar/i.test(description) ? FALLBACKS["gold-fold"] : /maxim/i.test(description) ? FALLBACKS["suprema-maxim"] : /gold/i.test(description) && /4\s*folhas/i.test(description) ? FALLBACKS["gold-4"] : /gold/i.test(description) ? FALLBACKS["gold-3"] : /4\s*folhas/i.test(description) ? FALLBACKS["suprema-4"] : FALLBACKS["suprema-2"];
const MASTER_PROMPT = "Create a photorealistic premium TECHNICAL 3D product render of a Brazilian architectural aluminum window/door system. Isometric three-quarter perspective, isolated object on a pure deep black #0B0F19 studio background. Dramatic controlled studio strip lighting, precise metallic reflections, physically accurate anodized/electrostatic aluminum, realistic glass reflections and subtle transparency. Show authentic extrusion profiles, frame and sash cross-section cues, meeting stiles, corner cleats, screws, anchors/chumbadores, drainage slots, brushes/seals, roller carriages and upper/lower tracks wherever relevant. Crisp machined edges, accurate joinery, 45-degree mitred corners when visible, premium industrial design visualization, ultra-detailed, high contrast, 4K quality. No room scene, no people, no text, no labels, no logos, no watermark, no dimensions. The image must depict a plausible product concept, not claim certified structural specifications.";
function send(res:any,status:number,body:unknown){res.setHeader?.("Cache-Control","no-store, private");return res.status(status).json(body);}
export default async function handler(req:Request,res:any){
  res.setHeader?.("Cache-Control","no-store, private");
  if(req.method!=="POST"){res.setHeader?.("Allow","POST");return send(res,405,{error:"Método não permitido."});}
  const ip=getClientIp(req);
  try {
    const quota = getAIRateLimit("generate-3d-render");
    if(!(await consumeRateLimit("generate-3d-render",ip,quota.limit,quota.windowMs))) {
      return send(res,200,{image:FALLBACKS["suprema-2"],fallback:true,message:"Limite de geração atingido. Exibindo a galeria local de respaldo."});
    }
  } catch(rateLimitError:any) {
    console.error("[GENERATE_3D_RATE_LIMIT_UNAVAILABLE]",String((rateLimitError as any)?.message||rateLimitError).slice(0,500));
    return send(res,503,{error:"O controle de uso está temporariamente indisponível.",code:"RATE_LIMIT_UNAVAILABLE"});
  }
  try{
    const body=(typeof req.body==="string"?JSON.parse(req.body):req.body||{}) as {description?:unknown;modelId?:unknown};
    const description=String(body.description||"").trim().slice(0,1200);
    if(description.length<8)return send(res,400,{error:"Descreva o modelo com pelo menos 8 caracteres."});
    const apiKey=process.env.AI_GATEWAY_API_KEY;
    const oidc=process.env.VERCEL_OIDC_TOKEN;
    if(!apiKey&&!oidc)return send(res,200,{image:fallbackFor(description),fallback:true,message:"Provedor de IA não configurado. Exibindo render técnico local."});
    let geminiError:any=null;
    try {
      const {generateText}=await import("ai");
      const result=await generateText({
        model:"google/gemini-nano-banana-2.1",
        prompt:`${MASTER_PROMPT}\n\nPRODUCT BRIEF FROM USER: ${description}`,
        maxOutputTokens:1200,
        abortSignal:AbortSignal.timeout(30_000),
      });
      const generated=(result as any).files?.find((file:any)=>String(file.mediaType||"").startsWith("image/"));
      if(generated?.uint8Array){
        const mime=generated.mediaType||"image/png";
        return send(res,200,{image:`data:${mime};base64,${Buffer.from(generated.uint8Array).toString("base64")}`,fallback:false,provider:"gemini-gateway"});
      }
      throw new Error("Gemini Nano Banana returned no image bytes.");
    } catch(error:any) {
      geminiError=error;
      console.error("[GENERATE_3D_RENDER] Gemini image generation failed; trying OpenAI Gateway fallback",{
        status:error?.status||error?.statusCode||0,
        message:String(error?.message||error).slice(0,700),
      });
    }
    try {
      const {generateImage}=await import("ai");
      const generated=await generateImage({
        model:process.env.ANACLETO_IMAGE_FALLBACK_MODEL||"openai/gpt-image-2.6-flare",
        prompt:`${MASTER_PROMPT}\n\nPRODUCT BRIEF FROM USER: ${description}`,
        abortSignal:AbortSignal.timeout(20_000),
      });
      const bytes=generated.image?.uint8Array;
      if(bytes?.length){
        const mime=generated.image.mediaType||"image/png";
        return send(res,200,{image:`data:${mime};base64,${Buffer.from(bytes).toString("base64")}`,fallback:false,provider:"openai-gateway-fallback"});
      }
      throw new Error("OpenAI Gateway image fallback returned no image bytes.");
    } catch(fallbackError:any) {
      console.error("[GENERATE_3D_RENDER] OpenAI Gateway image fallback failed",{
        status:fallbackError?.status||fallbackError?.statusCode||0,
        message:String(fallbackError?.message||fallbackError).slice(0,700),
        primaryError:String(geminiError?.message||geminiError).slice(0,300),
      });
      return send(res,200,{image:fallbackFor(description),fallback:true,message:"A geração de imagem está temporariamente indisponível. Exibindo render técnico local."});
    }
  }catch(error){console.error("[GENERATE_3D_RENDER_REQUEST]",error);return send(res,200,{image:FALLBACKS["suprema-2"],fallback:true,message:"Não foi possível processar o pedido. Exibindo render técnico local."});}
}
