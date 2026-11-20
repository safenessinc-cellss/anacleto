import firebaseConfig from "../../firebase-applet-config.json" with { type: "json" };

const OWNER_EMAIL = "safeness.c.a@gmail.com";
const windows = new Map<string, { startedAt: number; count: number }>();
const decode = (value: string) => value.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
const cleanText = (value: string) => decode(value.replace(/<[^>]*>/g," ")).replace(/\s+/g," ").trim().slice(0,600);
const safeUrl = (value: unknown) => { try { const url=new URL(String(value||"")); return ["http:","https:"].includes(url.protocol) ? url.toString() : ""; } catch { return ""; } };
const hostOf = (value: string) => { try { return new URL(value).hostname.replace(/^www\./,""); } catch { return ""; } };
async function searchWeb(query: string) {
 const url="https://html.duckduckgo.com/html/?q="+encodeURIComponent(query);
 const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 (compatible; AnacletoCatalogSearch/1.0)","Accept":"text/html"},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error("Busca de catálogos indisponível (HTTP "+response.status+").");
 const html=await response.text();const results:any[]=[];const blocks=html.split(/<div class="result[^"]*"[^>]*>/i).slice(1);
 for(const block of blocks){const link=block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);if(!link)continue;let url=decode(link[1]);if(url.startsWith("//"))url="https:"+url;try{const parsed=new URL(url);if(parsed.hostname.includes("duckduckgo.com")&&parsed.searchParams.has("uddg"))url=decodeURIComponent(parsed.searchParams.get("uddg")||url);}catch{}url=safeUrl(url);if(!url)continue;const snippet=block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)||block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/td>/i);results.push({title:cleanText(link[2]),url,domain:hostOf(url),snippet:snippet?cleanText(snippet[1]):"",kind:/\.pdf(?:$|[?#])/i.test(url)?"pdf":"website"});if(results.length>=12)break;}
 return results;
}
async function searchImages(query: string) {
 const landing="https://duckduckgo.com/?q="+encodeURIComponent(query)+"&iax=images&ia=images";
 const page=await fetch(landing,{headers:{"User-Agent":"Mozilla/5.0 (compatible; AnacletoCatalogSearch/1.0)","Accept":"text/html"},signal:AbortSignal.timeout(12000)});
 if(!page.ok)throw new Error("Busca de imagens indisponível.");
 const html=await page.text();const token=html.match(/vqd=['"]([^'"]+)['"]/)?.[1]||html.match(/vqd=([^&"'\s]+)/)?.[1];
 if(!token)return [];
 const response=await fetch("https://duckduckgo.com/i.js?l=us-en&o=json&q="+encodeURIComponent(query)+"&vqd="+encodeURIComponent(token)+"&f=,,,,,&p=1",{headers:{"User-Agent":"Mozilla/5.0 (compatible; AnacletoCatalogSearch/1.0)","Accept":"application/json"},signal:AbortSignal.timeout(12000)});
 if(!response.ok)return [];
 const data:any=await response.json();return (Array.isArray(data.results)?data.results:[]).slice(0,18).map((item:any)=>({title:cleanText(String(item.title||"Imagem de produto")),imageUrl:safeUrl(item.image),thumbnailUrl:safeUrl(item.thumbnail),sourceUrl:safeUrl(item.url),domain:hostOf(String(item.url||"")),width:Number(item.width)||null,height:Number(item.height)||null})).filter((item:any)=>item.imageUrl&&item.sourceUrl);
}
export default async function handler(req:any,res:any){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="POST")return res.status(405).json({error:"Método não permitido."});
 try{
  const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  const apiKey=process.env.FIREBASE_API_KEY||process.env.VITE_FIREBASE_API_KEY||firebaseConfig.apiKey;
  if(!token)return res.status(401).json({error:"Autenticação obrigatória."});
  if(!apiKey)return res.status(503).json({error:"Configuração Firebase ausente no servidor."});
  const auth=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+apiKey,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(10000)});
  if(!auth.ok)return res.status(401).json({error:"Sessão inválida ou expirada."});
  const authData:any=await auth.json();const user=authData.users?.[0];if(!user?.localId||!user?.email)return res.status(401).json({error:"Usuário não autenticado."});
  if(String(user.email).toLowerCase()!==OWNER_EMAIL){const databaseId=encodeURIComponent(firebaseConfig.firestoreDatabaseId||"(default)");const roleUrl="https://firestore.googleapis.com/v1/projects/"+firebaseConfig.projectId+"/databases/"+databaseId+"/documents/admins/"+encodeURIComponent(String(user.email).toLowerCase());const roleResponse=await fetch(roleUrl,{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(10000)});if(!roleResponse.ok)return res.status(403).json({error:"Acesso pendente de aprovação ou perfil não autorizado."});const roleDoc:any=await roleResponse.json();const role=String(roleDoc.fields?.role?.stringValue||"");if(!["super_admin","super_usuario","ceo","admin","supervisor","colaborador","financeiro"].includes(role))return res.status(403).json({error:"Seu perfil não tem autorização para pesquisar catálogos."});}
  const now=Date.now(),entry=windows.get(user.localId);if(!entry||now-entry.startedAt>=60000)windows.set(user.localId,{startedAt:now,count:1});else if(entry.count>=8)return res.status(429).json({error:"Limite de buscas atingido. Aguarde um minuto."});else entry.count++;
  const body=typeof req.body==="string"?JSON.parse(req.body):req.body;const query=String(body?.query||"").trim().slice(0,180);const supplier=String(body?.supplier||"").trim().slice(0,100);const category=String(body?.category||"").trim().slice(0,80);const includeImages=body?.includeImages!==false;
  if(query.length<2&&!supplier)return res.status(400).json({error:"Informe um fornecedor ou um termo de busca."});
  const terms=[supplier,query,category].filter(Boolean).join(" ");const [documents,images]=await Promise.allSettled([
   searchWeb(terms+" catálogo oficial produtos fornecedor PDF ficha técnica"),
   includeImages?searchImages(terms+" produtos catálogo fabricante"):Promise.resolve([])
  ]);
  const documentResults=documents.status==="fulfilled"?documents.value:[];const imageResults=images.status==="fulfilled"?images.value:[];
  if(!documentResults.length&&!imageResults.length)return res.status(502).json({error:"Nenhum resultado foi encontrado. Tente usar o nome da marca ou fornecedor junto ao tipo de produto.",details:[documents.status==="rejected"?String(documents.reason?.message||"Busca textual falhou"):"",images.status==="rejected"?String(images.reason?.message||"Busca de imagens falhou"):""].filter(Boolean)});
  return res.status(200).json({query:terms,documents:documentResults,images:imageResults,provider:"DuckDuckGo",reviewRequired:true,notice:"Resultados externos para pesquisa. Confirme fornecedor, modelo e autorização de uso das imagens antes de publicar."});
 }catch(error:any){console.error("Supplier catalog web search failed",error);return res.status(502).json({error:"Não foi possível concluir a busca agora. Tente novamente."});}
}
