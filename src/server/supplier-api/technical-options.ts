import firebaseConfig from "../../../firebase-applet-config.json" with { type: "json" };
const decode=(v:any):any=>!v||typeof v!=="object"?v:"stringValue"in v?v.stringValue:"integerValue"in v?Number(v.integerValue):"doubleValue"in v?v.doubleValue:"booleanValue"in v?v.booleanValue:"timestampValue"in v?v.timestampValue:"nullValue"in v?null:"mapValue"in v?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)])):v;
async function readCollection(name:string,token:string){
 const url="https://firestore.googleapis.com/v1/projects/"+firebaseConfig.projectId+"/databases/"+encodeURIComponent(firebaseConfig.firestoreDatabaseId||"(default)")+"/documents/"+name+"?pageSize=1000";
 const response=await fetch(url,{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(3000)});
 if(!response.ok)throw new Error("Não foi possível ler "+name+".");
 const data:any=await response.json();
 return(data.documents||[]).map((d:any)=>({id:d.name.split("/").pop(),...Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,decode(v)]))}));
}
export default async function handler(req:any,res:any){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET")return res.status(405).json({error:"Método não permitido."});
 try{
  const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if(!token)return res.status(401).json({error:"Autenticação obrigatória."});
  const apiKey=process.env.FIREBASE_API_KEY||process.env.VITE_FIREBASE_API_KEY||firebaseConfig.apiKey;
  const auth=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+apiKey,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(3000)});
  if(!auth.ok)return res.status(401).json({error:"Sessão inválida."});
  const [profiles,rules]=await Promise.all([readCollection("aluminum_profiles",token),readCollection("cutting_rules",token)]);
  const verified=(x:any)=>x.status==="verified";
  const unique=(values:any[])=>[...new Set(values.map(x=>String(x||"").trim()).filter(Boolean))].sort();
  const systems=unique(rules.filter(verified).map(x=>JSON.stringify({manufacturer:x.manufacturer,line:x.line,typology:x.typology,configuration:x.configuration||""}))).map(x=>JSON.parse(x));
  const available=systems.filter((s:any)=>profiles.some((p:any)=>verified(p)&&String(p.manufacturer||"").toLowerCase()===String(s.manufacturer||"").toLowerCase()&&String(p.line||"").toLowerCase()===String(s.line||"").toLowerCase()));
  return res.status(200).json({systems:available,manufacturers:unique(available.map((x:any)=>x.manufacturer)),lines:unique(available.map((x:any)=>x.line)),typologies:unique(available.map((x:any)=>x.typology)),configurations:unique(available.map((x:any)=>x.configuration)),finishes:unique(profiles.filter(verified).map((x:any)=>x.finish)),loadedAt:new Date().toISOString()});
 }catch(error:any){return res.status(502).json({error:String(error?.message||"Falha ao carregar opções técnicas.")});}
}
