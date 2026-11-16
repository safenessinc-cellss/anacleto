import { generateText } from "ai";

type WindowRequest = { description?: string; referenceImage?: string };
const buckets = new Map<string,{count:number;reset:number}>();
const fallbackSvg = (description:string) => {
 const safe=description.replace(/[<>&"]/g," ").slice(0,120);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="g"><stop stop-color="#27313a"/><stop offset=".5" stop-color="#9baab5"/><stop offset="1" stop-color="#26313a"/></linearGradient><linearGradient id="v"><stop stop-color="#a8c9d9" stop-opacity=".8"/><stop offset="1" stop-color="#eaf5fa" stop-opacity=".25"/></linearGradient></defs><rect width="1200" height="800" fill="#e9ecef"/><rect x="70" y="60" width="1060" height="680" rx="18" fill="#dce1e5"/><path d="M310 145h580v510H310z" fill="url(#g)"/><path d="M335 170h255v460H335zM610 170h255v460H610z" fill="url(#v)" stroke="#dbe5eb" stroke-width="10"/><path d="M600 170v460" stroke="#52616c" stroke-width="14"/><path d="M170 655h860" stroke="#aab3ba" stroke-width="8"/><text x="600" y="710" text-anchor="middle" font-family="Arial" font-size="18" fill="#53616c">PRÉVIA DE REFERÊNCIA · NÃO É UM RENDER IA</text><text x="600" y="770" text-anchor="middle" font-family="Arial" font-size="13" fill="#53616c">${safe}</text></svg>`;
 return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};
export default async function handler(req:any,res:any){
 res.setHeader?.("Cache-Control","no-store");
 if(req.method!=="POST"){res.setHeader?.("Allow","POST");return res.status(405).json({error:"Método não permitido."});}
 const ip=String(req.headers?.["x-real-ip"]||req.headers?.["x-forwarded-for"]||req.socket?.remoteAddress||"unknown").split(",")[0].trim();
 const now=Date.now(),bucket=buckets.get(ip);if(!bucket||now>bucket.reset)buckets.set(ip,{count:1,reset:now+60000});else if(bucket.count>=3)return res.status(429).json({error:"Limite temporário atingido. Tente novamente em um minuto."});else bucket.count++;
 try{
  const body=(typeof req.body==="string"?JSON.parse(req.body):req.body||{}) as WindowRequest;
  const description=String(body.description||"").trim().slice(0,1800);
  if(description.length<8)return res.status(400).json({error:"Descreva o ambiente e a esquadria desejada."});
  let image:string|undefined;
  if(body.referenceImage){
   if(typeof body.referenceImage!=="string"||body.referenceImage.length>4_300_000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(body.referenceImage))return res.status(400).json({error:"Imagem inválida. Envie PNG, JPG ou WebP de até 3 MB."});
   image=body.referenceImage;
  }
  if(!process.env.AI_GATEWAY_API_KEY&&!process.env.VERCEL_OIDC_TOKEN)return res.status(200).json({image:fallbackSvg(description),fallback:true,message:"Provedor de imagem não configurado. Esta é uma prévia vetorial local, não um render de IA."});
  try{
   const {result}=await import("ai").then(async({generateText})=>({result:await generateText({
    model:"google/gemini-3.1-flash-image-preview",
    messages:[{role:"user",content:[{type:"text",text:`Gere um render fotorrealista arquitetônico horizontal 3:2 de uma esquadria de alumínio sob medida instalada em uma residência contemporânea brasileira. Descrição do cliente: ${description}. Mostre proporções plausíveis, perfis de alumínio bem definidos, vidro fisicamente plausível, luz natural, fachada premium, fotografia de arquitetura editorial. Não inclua texto, marcas, logotipos ou medidas. A imagem enviada, se houver, é a referência da obra; preserve a arquitetura existente e integre a esquadria no vão.`},...(image?[{type:"image" as const,image,mimeType:image.slice(5,image.indexOf(";"))}]:[])]}] as any,
    maxOutputTokens:1200,
   })}));
   const generated=(result as any).files?.find((file:any)=>String(file.mediaType||"").startsWith("image/"));
   if(generated?.uint8Array){const mime=generated.mediaType||"image/png";return res.status(200).json({image:`data:${mime};base64,${Buffer.from(generated.uint8Array).toString("base64")}`,fallback:false});}
   return res.status(200).json({image:fallbackSvg(description),fallback:true,message:"O modelo não retornou uma imagem nesta tentativa. Exibimos uma prévia vetorial local."});
  }catch(error){console.error("[PUBLIC_ARCHITECTURAL_IMAGE]",error);return res.status(200).json({image:fallbackSvg(description),fallback:true,message:"A visualização com IA está temporariamente indisponível. Exibimos uma prévia vetorial local."});}
 }catch(error){console.error("[PUBLIC_ARCHITECTURAL_REQUEST]",error);return res.status(200).json({image:fallbackSvg("Esquadria de alumínio sob medida"),fallback:true,message:"Não foi possível processar a solicitação. Exibimos uma prévia local."});}
}
