import firebaseConfig from "../../firebase-applet-config.json" with { type: "json" };

const OWNER_EMAIL="safeness.c.a@gmail.com";
const decode=(v:any):any=>!v||typeof v!=="object"?v:"stringValue"in v?v.stringValue:"integerValue"in v?Number(v.integerValue):"doubleValue"in v?Number(v.doubleValue):"booleanValue"in v?v.booleanValue:"timestampValue"in v?v.timestampValue:"nullValue"in v?null:"mapValue"in v?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)])):v;
async function docs(collectionName:string,token:string){
 const url="https://firestore.googleapis.com/v1/projects/"+firebaseConfig.projectId+"/databases/"+encodeURIComponent(firebaseConfig.firestoreDatabaseId||"(default)")+"/documents/"+collectionName+"?pageSize=1000";
 const r=await fetch(url,{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw new Error("Não foi possível consultar "+collectionName+".");
 const data:any=await r.json();
 return(data.documents||[]).map((d:any)=>({id:d.name.split("/").pop(),...Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,decode(v)]))}));
}
const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
function barsFor(item:any){
 if(item.unit!=="bar"||!Array.isArray(item.cutLengthsMm)||!item.commercialBarLengthMm)return Number(item.quantity||0);
 const length=Number(item.commercialBarLengthMm),kerf=Number(item.kerfMm||3),bins:number[]=[];
 for(const cut of [...item.cutLengthsMm].map(Number).sort((a,b)=>b-a)){
  let index=bins.findIndex(used=>used+(used?kerf:0)+cut<=length);
  if(index<0){bins.push(cut);}else bins[index]+=kerf+cut;
 }
 return bins.length;
}
export default async function handler(req:any,res:any){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="POST")return res.status(405).json({error:"Método não permitido."});
 try{
  const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if(!token)return res.status(401).json({error:"Autenticação obrigatória."});
  const apiKey=process.env.FIREBASE_API_KEY||process.env.VITE_FIREBASE_API_KEY||firebaseConfig.apiKey;
  const auth=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+apiKey,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(10000)});
  if(!auth.ok)return res.status(401).json({error:"Sessão inválida."});
  const identity:any=await auth.json(),user=identity.users?.[0];
  if(!user?.email)return res.status(401).json({error:"Usuário não autenticado."});
  if(String(user.email).toLowerCase()!==OWNER_EMAIL){
   const admins=await docs("admins",token),admin=admins.find((x:any)=>String(x.id).toLowerCase()===String(user.email).toLowerCase());
   if(!admin||!["super_admin","super_usuario","ceo","admin","supervisor","colaborador"].includes(String(admin.role||"")))return res.status(403).json({error:"Perfil sem permissão para comparar preços."});
  }
  const body=typeof req.body==="string"?JSON.parse(req.body):req.body;
  const items=Array.isArray(body?.items)?body.items.slice(0,100):[];
  if(!items.length)return res.status(400).json({error:"Informe a lista técnica de materiais."});
  const records=await docs("supplier_prices",token),now=Date.now(),group=new Map<string,any>();
  for(const row of records){
   if(row.status!=="verified"||row.priceStatus!=="verified")continue;
   if(!row.unitPrice||Number(row.unitPrice)<=0||String(row.currency||"BRL")!=="BRL")continue;
   const date=Date.parse(String(row.priceDate||""));
   if(!Number.isFinite(date)||now-date>30*86400000||date>now+300000)continue;
   if(row.validUntil&&Date.parse(String(row.validUntil))<now)continue;
   const supplier=String(row.supplier||row.manufacturer||"").trim();
   if(!supplier)continue;
   if(!group.has(supplier))group.set(supplier,{supplier,supplierUrl:String(row.supplierUrl||row.sourceUrl||""),lines:[],materialSubtotal:0,shippingCost:0,total:0,complete:true,verified:true,missingItems:[]});
  }
  for(const basket of group.values()){
   for(const item of items){
    const qty=barsFor(item);
    const candidates=records.filter((row:any)=>{
     const supplier=String(row.supplier||row.manufacturer||"").trim();
     return supplier===basket.supplier&&row.status==="verified"&&row.priceStatus==="verified"&&
      String(row.code||"").trim().toLowerCase()===String(item.code||"").trim().toLowerCase()&&
      String(row.line||"").trim().toLowerCase()===String(item.system||"").trim().toLowerCase()&&
      String(row.unit||"").trim().toLowerCase()===String(item.unit||"").trim().toLowerCase()&&
      String(row.finish||"").trim().toLowerCase()===String(item.finish||"").trim().toLowerCase()&&
      Number(row.unitPrice)>0&&Date.parse(String(row.priceDate||""))>=now-30*86400000&&(!row.validUntil||Date.parse(String(row.validUntil))>=now);
    }).sort((a:any,b:any)=>Number(a.unitPrice)-Number(b.unitPrice));
    const offer=candidates[0];
    if(!offer){
     basket.lines.push({itemId:item.id,description:item.description,quantityToBuy:qty,unit:item.unit,unitPrice:null,subtotal:null,status:"missing_price"});
     basket.complete=false;basket.verified=false;basket.missingItems.push(item.description);continue;
    }
    const subtotal=money(qty*Number(offer.unitPrice));
    basket.lines.push({itemId:item.id,description:item.description,quantityToBuy:qty,unit:item.unit,unitPrice:Number(offer.unitPrice),subtotal,status:"priced",sourceUrl:offer.sourceUrl||"",priceDate:offer.priceDate,validUntil:offer.validUntil||null});
    basket.materialSubtotal+=subtotal;
    basket.shippingCost=Math.max(basket.shippingCost,Number(offer.shippingCost||0));
   }
   basket.materialSubtotal=money(basket.materialSubtotal);basket.shippingCost=money(basket.shippingCost);basket.total=money(basket.materialSubtotal+basket.shippingCost);
  }
  const comparisons=[...group.values()].sort((a,b)=>a.complete!==b.complete?(a.complete?-1:1):a.total-b.total);
  const best=comparisons.find(x=>x.complete&&x.verified);
  return res.status(200).json({comparisons,bestSupplier:best?.supplier||null,allPricesVerified:true,comparedAt:new Date().toISOString(),notice:"Somente preços aprovados, em BRL e com cotação dos últimos 30 dias foram considerados. Cestas incompletas não recebem recomendação de compra."});
 }catch(error:any){console.error("ANACLETO supplier comparison failed",error);return res.status(502).json({error:String(error?.message||"Falha ao comparar fornecedores.")});}
}
