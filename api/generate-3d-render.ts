type Request = { method?: string; headers?: Record<string, string | string[] | undefined>; body?: unknown; socket?: { remoteAddress?: string } };
const buckets = new Map<string, { count: number; reset: number }>();
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
  const forwarded=req.headers?.["x-forwarded-for"];
  const ip=String(req.headers?.["x-real-ip"]||forwarded||req.socket?.remoteAddress||"unknown").split(",")[0].trim();
  const now=Date.now();let bucket=buckets.get(ip);
  if(!bucket||now>bucket.reset){bucket={count:0,reset:now+60_000};buckets.set(ip,bucket);}
  if(bucket.count>=3)return send(res,200,{image:FALLBACKS["suprema-2"],fallback:true,message:"Limite de geração atingido. Exibindo a galeria local de respaldo."});
  bucket.count++;
  try{
    const body=(typeof req.body==="string"?JSON.parse(req.body):req.body||{}) as {description?:unknown;modelId?:unknown};
    const description=String(body.description||"").trim().slice(0,1200);
    if(description.length<8)return send(res,400,{error:"Descreva o modelo com pelo menos 8 caracteres."});
    const apiKey=process.env.AI_GATEWAY_API_KEY;
    const oidc=process.env.VERCEL_OIDC_TOKEN;
    if(!apiKey&&!oidc)return send(res,200,{image:fallbackFor(description),fallback:true,message:"Provedor de IA não configurado. Exibindo render técnico local."});
    try{
      const {generateText}=await import("ai");
      const result=await generateText({
        model:"google/gemini-nano-banana-2.1",
        prompt:`${MASTER_PROMPT}\n\nPRODUCT BRIEF FROM USER: ${description}`,
        maxOutputTokens:1200,
      });
      const generated=(result as any).files?.find((file:any)=>String(file.mediaType||"").startsWith("image/"));
      if(generated?.uint8Array){
        const mime=generated.mediaType||"image/png";
        return send(res,200,{image:`data:${mime};base64,${Buffer.from(generated.uint8Array).toString("base64")}`,fallback:false});
      }
      return send(res,200,{image:fallbackFor(description),fallback:true,message:"A IA não retornou uma imagem nesta tentativa. Exibindo render técnico local."});
    }catch(error){console.error("[GENERATE_3D_RENDER]",error);return send(res,200,{image:fallbackFor(description),fallback:true,message:"Geração indisponível no momento. Exibindo render técnico local."});}
  }catch(error){console.error("[GENERATE_3D_RENDER_REQUEST]",error);return send(res,200,{image:FALLBACKS["suprema-2"],fallback:true,message:"Não foi possível processar o pedido. Exibindo render técnico local."});}
}
