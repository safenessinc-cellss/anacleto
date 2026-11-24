import { GoogleGenAI } from "@google/genai";
import { consumeRateLimit, getClientIp } from "../../src/server/rate-limit.js";
import { getAIGatewayFallbackModel } from "../../src/server/ai-config.js";
import { getAIRateLimit } from "../../src/server/ai-limits.js";

type WindowRequest = { description?: string; referenceImage?: string };
const fallbackSvg = (description:string) => {
 const safe=description.replace(/[<>&"]/g," ").slice(0,120);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="g"><stop stop-color="#27313a"/><stop offset=".5" stop-color="#9baab5"/><stop offset="1" stop-color="#26313a"/></linearGradient><linearGradient id="v"><stop stop-color="#a8c9d9" stop-opacity=".8"/><stop offset="1" stop-color="#eaf5fa" stop-opacity=".25"/></linearGradient></defs><rect width="1200" height="800" fill="#e9ecef"/><rect x="70" y="60" width="1060" height="680" rx="18" fill="#dce1e5"/><path d="M310 145h580v510H310z" fill="url(#g)"/><path d="M335 170h255v460H335zM610 170h255v460H610z" fill="url(#v)" stroke="#dbe5eb" stroke-width="10"/><path d="M600 170v460" stroke="#52616c" stroke-width="14"/><path d="M170 655h860" stroke="#aab3ba" stroke-width="8"/><text x="600" y="710" text-anchor="middle" font-family="Arial" font-size="18" fill="#53616c">PRÉVIA DE REFERÊNCIA · NÃO É UM RENDER IA</text><text x="600" y="770" text-anchor="middle" font-family="Arial" font-size="13" fill="#53616c">${safe}</text></svg>`;
 return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};
export default async function handler(req:any,res:any){
 res.setHeader?.("Cache-Control","no-store");
 if(req.method!=="POST"){res.setHeader?.("Allow","POST");return res.status(405).json({error:"Método não permitido."});}
 const ip=getClientIp(req);
 try {
  const quota = getAIRateLimit("public-architectural-visualization");
  if(!(await consumeRateLimit("public-architectural-visualization",ip,quota.limit,quota.windowMs))) return res.status(429).json({error:"Limite temporário atingido. Tente novamente em um minuto."});
 } catch(rateLimitError:any) {
  console.error("[PUBLIC_ARCHITECTURAL_RATE_LIMIT_UNAVAILABLE]",String(rateLimitError?.message||rateLimitError).slice(0,500));
  return res.status(503).json({error:"O controle de uso está temporariamente indisponível.",code:"RATE_LIMIT_UNAVAILABLE"});
 }
 try{
  const body=(typeof req.body==="string"?JSON.parse(req.body):req.body||{}) as WindowRequest;
  const description=String(body.description||"").trim().slice(0,1800);
  if(description.length<8)return res.status(400).json({error:"Descreva o ambiente e a esquadria desejada."});
  let image:string|undefined;
  if(body.referenceImage){
   if(typeof body.referenceImage!=="string"||body.referenceImage.length>4_300_000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(body.referenceImage))return res.status(400).json({error:"Imagem inválida. Envie PNG, JPG ou WebP de até 3 MB."});
   image=body.referenceImage;
  }
  const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY;
  if(!apiKey)return res.status(200).json({image:fallbackSvg(description),fallback:true,message:"GEMINI_API_KEY não configurada. Esta é uma prévia vetorial local, não um render de IA."});
  const prompt=`Gere um render fotorrealista arquitetônico horizontal 3:2 de uma esquadria de alumínio sob medida instalada em uma residência contemporânea brasileira. Descrição do cliente: ${description}. Mostre proporções plausíveis, perfis de alumínio bem definidos, vidro fisicamente plausível, luz natural, fachada premium, fotografia de arquitetura editorial. Não inclua texto, marcas, logotipos ou medidas. A imagem enviada, se houver, é a referência da obra; preserve a arquitetura existente e integre a esquadria no vão.`;
   const gatewayConfigured=Boolean(process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN);
   let primaryError:any=null;
   try {
    const client=new GoogleGenAI({apiKey});
    const parts:any[]=[{text:prompt}];
    if(image){const comma=image.indexOf(",");const header=image.slice(0,comma);const mime=header.slice(5,header.indexOf(";"));parts.push({inlineData:{mimeType:mime,data:image.slice(comma+1)}});}
    const result=await client.models.generateContent({
     model:process.env.ANACLETO_IMAGE_MODEL||"gemini-nano-banana-2.1",
     contents:[{role:"user",parts}],
     config:{responseModalities:["IMAGE","TEXT"],imageConfig:{aspectRatio:"3:2"},abortSignal:AbortSignal.timeout(30_000)},
    });
    const generated=result.candidates?.flatMap((candidate:any)=>candidate.content?.parts||[]).find((part:any)=>part.inlineData?.data&&String(part.inlineData.mimeType||"").startsWith("image/"));
    if(generated?.inlineData?.data){const mime=generated.inlineData.mimeType||"image/png";return res.status(200).json({image:`data:${mime};base64,${generated.inlineData.data}`,fallback:false,provider:"gemini-direct"});}
    throw new Error("Gemini did not return an image part.");
   } catch(error:any) {
    primaryError=error;
    console.error("[PUBLIC_ARCHITECTURAL_IMAGE] Gemini failed; trying AI Gateway image fallback",{
     status:error?.status||error?.statusCode||0,message:String(error?.message||error).slice(0,700)
    });
   }
   if(gatewayConfigured) {
    try {
     const { generateImage, generateText }=await import("ai");
     const imageBytes=image?Buffer.from(image.slice(image.indexOf(",")+1),"base64"):undefined;
     let fallbackPrompt=prompt;
     if(imageBytes){
      const reference=await generateText({
       model:getAIGatewayFallbackModel(),
       system:"Descreva objetivamente a arquitetura, o vão, a posição da esquadria, os materiais, as cores, a iluminação e a perspectiva da imagem de referência. Não invente medidas.",
       messages:[{role:"user",content:[
        {type:"text",text:"Analise esta imagem para orientar um render arquitetônico fiel."},
        {type:"image",image:imageBytes}
       ]}],
       providerOptions:{gateway:{only:["openai","azure"]}},
       maxOutputTokens:700,
       abortSignal:AbortSignal.timeout(12_000),
      });
      fallbackPrompt+="\nDescrição visual da referência: "+reference.text.slice(0,2500);
     }
     const generated=await generateImage({
      model:process.env.ANACLETO_IMAGE_FALLBACK_MODEL||"openai/gpt-image-2.6-flare",
      prompt:fallbackPrompt,
      abortSignal:AbortSignal.timeout(20_000),
     });
     const bytes=generated.image?.uint8Array;
     if(bytes?.length){
      const mime=generated.image.mediaType||"image/png";
      return res.status(200).json({image:`data:${mime};base64,${Buffer.from(bytes).toString("base64")}`,fallback:false,provider:"openai-gateway-fallback"});
     }
     throw new Error("AI Gateway image fallback returned no image bytes.");
    } catch(fallbackError:any) {
     console.error("[PUBLIC_ARCHITECTURAL_IMAGE] AI Gateway fallback failed",{
      status:fallbackError?.status||fallbackError?.statusCode||0,
      message:String(fallbackError?.message||fallbackError).slice(0,700)
     });
    }
   }
   console.error("[PUBLIC_ARCHITECTURAL_IMAGE] no provider generated an image",{
    message:String(primaryError?.message||primaryError).slice(0,700)
   });
   return res.status(200).json({image:fallbackSvg(description),fallback:true,message:"A geração de imagem por IA está temporariamente indisponível. Exibimos uma prévia vetorial local."});
 }catch(error){console.error("[PUBLIC_ARCHITECTURAL_REQUEST]",error);return res.status(200).json({image:fallbackSvg("Esquadria de alumínio sob medida"),fallback:true,message:"Não foi possível processar a solicitação. Exibimos uma prévia local."});}
}
