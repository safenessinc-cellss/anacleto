import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";

const OWNER_EMAIL = "safeness.c.a@gmail.com";
const schema = { type: Type.OBJECT, properties: { products: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
 name:{type:Type.STRING}, code:{type:Type.STRING}, category:{type:Type.STRING,enum:["Perfil de alumínio","Vidro","Ferragem","Acessório","Janela","Porta","Box de banheiro","Serviço","Outro"]}, material:{type:Type.STRING}, unit:{type:Type.STRING}, price:{type:Type.NUMBER,nullable:true}, lengthMm:{type:Type.NUMBER,nullable:true}, thicknessMm:{type:Type.NUMBER,nullable:true}, weightKg:{type:Type.NUMBER,nullable:true}, side:{type:Type.STRING}, position:{type:Type.STRING}, page:{type:Type.NUMBER}, confidence:{type:Type.NUMBER}, notes:{type:Type.STRING}
 }, required:["name","code","category","material","unit","side","position","page","confidence","notes"] } } }, required:["products"] };
export default async function handler(req: VercelRequest,res:VercelResponse){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="POST")return res.status(405).json({error:"Método não permitido."});
 try{
  const token=String(req.headers.authorization||"").replace(/^Bearer\\s+/i,"");
  const apiKey=process.env.FIREBASE_API_KEY||process.env.VITE_FIREBASE_API_KEY;
  if(!token||!apiKey)return res.status(401).json({error:"Sessão não autenticada."});
  const auth=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+apiKey,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(10000)});
  if(!auth.ok)return res.status(401).json({error:"Sessão inválida ou expirada."});
  const authData:any=await auth.json();const user=authData.users?.[0];if(!user?.localId)return res.status(401).json({error:"Usuário não autenticado."});
  const key=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY;if(!key)return res.status(503).json({error:"IA visual indisponível: configure GEMINI_API_KEY no ambiente de produção."});
  const body=typeof req.body==="string"?JSON.parse(req.body):req.body;const images=Array.isArray(body?.images)?body.images:[];
  if(!images.length||images.length>20)return res.status(400).json({error:"Envie entre 1 e 20 páginas ou imagens por importação."});
  const parts:any[]=[{text:"Você é um especialista técnico em catálogos de esquadrias de alumínio, vidro e ferragens. Analise visualmente cada página/foto. Extraia somente dados visíveis e legíveis. Uma peça esquerda e uma direita são produtos distintos; preserve códigos e sufixos exatamente. Identifique lado (esquerdo/direito/central/não identificado), posição/uso, espessura e comprimento em milímetros, peso e preço. Não confunda números de dimensão, quantidade, referência ou preço. Se houver várias peças na mesma página, gere um produto por peça. Categoria deve ser Perfil de alumínio, Vidro, Ferragem, Acessório, Janela, Porta, Box de banheiro, Serviço ou Outro. Preço ausente deve ser null, nunca zero. Dimensões/peso não legíveis devem ser omitidos. Não invente nem complete referências. confidence entre 0 e 1. notes descreve dúvidas e texto ilegível. page é o número da página fornecido."}];
  for(const image of images){if(typeof image.data!=="string"||image.data.length>9_000_000||!/^image\\/(jpeg|png|webp)$/i.test(String(image.mimeType)))return res.status(400).json({error:"Imagem inválida ou demasiado grande."});parts.push({text:"Página "+Number(image.page||1)+":"},{inlineData:{mimeType:image.mimeType,data:image.data}});}
  const client=new GoogleGenAI({apiKey:key});const result=await client.models.generateContent({model:"gemini-2.5-flash",contents:[{role:"user",parts}],config:{responseMimeType:"application/json",responseSchema:schema,temperature:0.1,maxOutputTokens:8192}});
  const parsed=JSON.parse(result.text||"{\"products\":[]}");const products=(Array.isArray(parsed.products)?parsed.products:[]).map((p:any)=>({...p,price:Number.isFinite(p.price)?p.price:null,confidence:Math.max(0,Math.min(1,Number(p.confidence)||0))}));
  return res.status(200).json({products,model:"gemini-2.5-flash",reviewRequired:true});
 }catch(error){console.error("Supplier catalog visual extraction failed",error);return res.status(500).json({error:error instanceof Error?error.message:"Falha interna na interpretação visual."});}
}
