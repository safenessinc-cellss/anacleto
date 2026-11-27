import { GoogleGenAI } from "@google/genai";
import { consumeRateLimit, getClientIp } from "../../src/server/rate-limit.js";
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
 const quota=getAIRateLimit("architectural-visualization");
 try {
  if(!(await consumeRateLimit("architectural-visualization",getClientIp(req),quota.limit,quota.windowMs)) {
   return res.status(429).json({error:"Limite temporário atingido. Tente novamente em um minuto.",code:"RATE_LIMITED"});
  }
 } catch(rateError:any) {
  console.error("[ARCHITECTURAL_VISUALIZATION_RATE_LIMIT]",String(rateError?.message||rateError).slice(0,500));
  return res.status(503).json({error:"Controle de uso indisponível no momento.",code:"RATE_LIMIT_UNAVAILABLE"});
 }
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
  try{
   const client=new GoogleGenAI({apiKey});
   const parts:any[]=[{text:`Gere um render fotorrealista arquitetônico horizontal 3:2 de uma esquadria de alumínio sob medida instalada em uma residência contemporânea brasileira. Descrição do cliente: ${description}. Mostre proporções plausíveis, perfis de alumínio bem definidos, vidro fisicamente plausível, luz natural, fachada premium, fotografia de arquitetura editorial. Não inclua texto, marcas, logotipos ou medidas. A imagem enviada, se houver, é a referência da obra; preserve a arquitetura existente e integre a esquadria no vão.`}];
   if(image){const comma=image.indexOf(",");const header=image.slice(0,comma);const mime=header.slice(5,header.indexOf(";"));parts.push({inlineData:{mimeType:mime,data:image.slice(comma+1)}});}
   const result=await client.models.generateContent({
    model:process.env.ANACLETO_IMAGE_MODEL||"gemini-3.1-flash-image-preview",
    contents:[{role:"user",parts}],
    config:{responseModalities:["IMAGE","TEXT"],imageConfig:{aspectRatio:"3:2"},abortSignal:AbortSignal.timeout(45_000)},
   });
   const generated=result.candidates?.flatMap((candidate:any)=>candidate.content?.parts||[]).find((part:any)=>part.inlineData?.data&&String(part.inlineData.mimeType||"").startsWith("image/"));
   if(generated?.inlineData?.data){const mime=generated.inlineData.mimeType||"image/png";return res.status(200).json({image:`data:${mime};base64,${generated.inlineData.data}`,fallback:false,provider:"gemini-direct"});}
   console.warn("[PUBLIC_ARCHITECTURAL_IMAGE] Gemini returned no image part", {model:process.env.ANACLETO_IMAGE_MODEL||"gemini-3.1-flash-image-preview"});
   return res.status(200).json({image:fallbackSvg(description),fallback:true,message:"O modelo não retornou uma imagem nesta tentativa. Exibimos uma prévia vetorial local."});
  }catch(error:any){console.error("[PUBLIC_ARCHITECTURAL_IMAGE]",{name:error?.name,status:error?.status||error?.statusCode,message:String(error?.message||error).slice(0,1000)});return res.status(200).json({image:fallbackSvg(description),fallback:true,message:"A geração de imagem por IA está temporariamente indisponível. Exibimos uma prévia vetorial local."});}
 }catch(error){console.error("[PUBLIC_ARCHITECTURAL_REQUEST]",error);return res.status(200).json({image:fallbackSvg("Esquadria de alumínio sob medida"),fallback:true,message:"Não foi possível processar a solicitação. Exibimos uma prévia local."});}
}
