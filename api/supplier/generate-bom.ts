import firebaseConfig from "../../firebase-applet-config.json" with { type: "json" };
import { evaluateTechnicalFormula } from "../../src/server/cut-formula";

type FirestoreDoc = Record<string, any>;
const OWNER_EMAIL = "safeness.c.a@gmail.com";
const fromValue = (value: any): any => {
  if (!value || typeof value !== "object") return value;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(fromValue);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k,v]) => [k, fromValue(v)]));
  return value;
};
const decodeDoc = (doc: any): FirestoreDoc => ({
  id: String(doc.name || "").split("/").pop(),
  ...Object.fromEntries(Object.entries(doc.fields || {}).map(([k,v]) => [k,fromValue(v)]))
});
async function collectionDocs(projectId: string, databaseId: string, collection: string, token: string) {
  const url = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/" +
    encodeURIComponent(databaseId) + "/documents/" + collection + "?pageSize=1000";
  const response = await fetch(url, { headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error("Não foi possível consultar " + collection + " na Ficha Técnica.");
  const data: any = await response.json();
  return (data.documents || []).map(decodeDoc) as FirestoreDoc[];
}

const roundQty = (value: number, unit: string) => ["piece","un","unidade","unidades","peça","peças"].includes(unit.toLowerCase()) ? Math.ceil(value) : Number(value.toFixed(3));

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Autenticação obrigatória." });
    const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey;
    const auth = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + apiKey, {
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(3000)
    });
    if (!auth.ok) return res.status(401).json({error:"Sessão inválida."});
    const identity:any=await auth.json(), user=identity.users?.[0];
    if (!user?.localId || !user?.email) return res.status(401).json({error:"Usuário não autenticado."});
    const databaseId= firebaseConfig.firestoreDatabaseId || "(default)";
    if (String(user.email).toLowerCase() !== OWNER_EMAIL) {
      const adminUrl="https://firestore.googleapis.com/v1/projects/"+firebaseConfig.projectId+"/databases/"+encodeURIComponent(databaseId)+"/documents/admins/"+encodeURIComponent(String(user.email).toLowerCase());
      const adminResponse=await fetch(adminUrl,{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(3000)});
      const adminData:any=adminResponse.ok?await adminResponse.json():null;
      const admin={role:adminData?.fields?.role?.stringValue||""};
      const allowed=["super_admin","super_usuario","ceo","admin","supervisor","colaborador"];
      if (!admin || !allowed.includes(String(admin.role||""))) return res.status(403).json({error:"Perfil sem permissão para gerar despiece técnico."});
    }
    const body=typeof req.body==="string"?JSON.parse(req.body):req.body;
    const manufacturer=String(body?.manufacturer||"").trim();
    const line=String(body?.line||"").trim();
    const typology=String(body?.typology||"").trim();
    const configuration=String(body?.configuration||"").trim();
    const width=Number(body?.widthMm), height=Number(body?.heightMm), quantity=Number(body?.quantity||1);
    const finish=String(body?.finish||"").trim();
    if(!manufacturer||!line||!typology||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!Number.isInteger(quantity)||quantity<1||quantity>500)
      return res.status(400).json({error:"Informe fabricante, linha, tipologia, largura, altura e quantidade válidos."});

    const [profiles,rules,hardware]=await Promise.all([
      collectionDocs(firebaseConfig.projectId,databaseId,"aluminum_profiles",token),
      collectionDocs(firebaseConfig.projectId,databaseId,"cutting_rules",token),
      collectionDocs(firebaseConfig.projectId,databaseId,"hardware_catalog",token)
    ]);
    const verified=(row:FirestoreDoc)=>row.status==="verified" && row.reviewStatus!=="rejected";
    const eq=(a:any,b:string)=>String(a||"").trim().toLowerCase()===b.toLowerCase();
    const matchedRules=rules.filter(row=>verified(row)&&eq(row.manufacturer,manufacturer)&&eq(row.line,line)&&eq(row.typology,typology)&&(!row.configuration||!configuration||eq(row.configuration,configuration)));
    const errors:string[]=[], bom:any[]=[];
    if(!matchedRules.length) errors.push("Nenhuma regra de corte verificada corresponde ao fabricante, linha, tipologia e configuração selecionados.");
    const profilePool=profiles.filter(row=>verified(row)&&eq(row.manufacturer,manufacturer)&&eq(row.line,line)&&(!finish||!row.finish||eq(row.finish,finish)));
    for(const rule of matchedRules) {
      const category=String(rule.category||"aluminum_profile");
      const isProfile=category==="aluminum_profile";
      const profile=isProfile?profilePool.find(row=>eq(row.code,String(rule.profileCode||""))):null;
      if(isProfile&&!profile) { errors.push("Perfil " + String(rule.profileCode||"(sem código)") + " sem cadastro verificado compatível."); continue; }
      const vars={W:width,H:height,L:width,Q:1};
      try {
        const unit=String(rule.unit||(isProfile?"bar":"piece"));
        const calculated=evaluateTechnicalFormula(String(rule.formula||""),vars);
        const commercialLength=Number(profile?.commercialLengthMm||0);
        const perProduct=rule.quantityFormula?evaluateTechnicalFormula(String(rule.quantityFormula),vars):Number(rule.cutCount||1);
        if(!Number.isFinite(perProduct)||perProduct<=0||perProduct>1000) throw new Error("Quantidade de cortes/consumo inválida.");
        let cuts:number[]|undefined;
        let count:number;
        if(isProfile) {
          if(!commercialLength) { errors.push("Perfil "+String(profile?.code)+": comprimento comercial não verificado."); continue; }
          if(calculated>commercialLength) throw new Error("Corte maior que a barra comercial.");
          cuts=Array.from({length:Math.ceil(perProduct*quantity)},()=>calculated);
          const bars:number[][]=[];
          for(const cut of [...cuts].sort((a,b)=>b-a)) {
            const kerf=Number(rule.kerfMm||3);
            const target=bars.find(bar=>bar.reduce((sum,n)=>sum+n,0)+bar.length*kerf+cut<=commercialLength);
            if(!target)bars.push([cut]);else target.push(cut);
          }
          count=bars.length;
        } else {
          count=roundQty(calculated*perProduct*quantity,unit);
        }
        const code=String(profile?.code||rule.profileCode||rule.code||"");
        const description=String(profile?.description||rule.description||code);
        const componentFinish=finish||profile?.finish||rule.finish||"";
        bom.push({
          id:String(rule.id),category,code,description,quantity:count,
          unit:isProfile?"bar":unit,cutLengthsMm:cuts,
          commercialBarLengthMm:isProfile?commercialLength:undefined,kerfMm:Number(rule.kerfMm||3),
          manufacturer,system:line,finish:componentFinish,weightKgM:Number(profile?.weightKgM||0)||undefined,compatibilityKey:[manufacturer,line,code,componentFinish].join(":").toLowerCase(),
          required:true,glassType:rule.glassType||"",glassThicknessMm:Number(rule.glassThicknessMm||0)||undefined,
          sourceDocumentId:rule.documentId||profile?.documentId||"",sourcePage:Number(rule.page||profile?.page||0)||undefined,
          ruleId:rule.id,technicalStatus:"verified",formula:rule.formula
        });
      } catch(error:any) { errors.push("Regra "+String(rule.id)+": "+String(error?.message||"fórmula inválida")); }
    }
    const matchingHardware=hardware.filter(row=>verified(row)&&eq(row.manufacturer,manufacturer)&&eq(row.line,line)&&(eq(row.typology,typology)||String(row.typology||"")==="*"||eq(row.typology,"Todas"))&&(!row.finish||!finish||eq(row.finish,finish)));
    if(!matchingHardware.length) errors.push("Nenhum acessório verificado com tipologia compatível cadastrado para este fabricante e linha. Cadastre roldanas, fechos, puxadores, escovas, borrachas e fixadores aplicáveis.");
    for(const part of matchingHardware) {
      if(!part.quantityFormula && !Number.isFinite(Number(part.quantity))) {
        errors.push("Acessório "+String(part.code||part.description)+" sem quantidade ou fórmula de consumo verificada.");
        continue;
      }
      try {
        const raw=part.quantityFormula?evaluateTechnicalFormula(String(part.quantityFormula),{W:width,H:height,L:width,Q:1}):Number(part.quantity);
        bom.push({id:String(part.id),category:"hardware",code:String(part.code||""),description:String(part.description||part.code||"Acessório"),
          quantity:roundQty(raw*quantity,String(part.unit||"piece")),unit:String(part.unit||"piece"),manufacturer,system:line,finish,
          compatibilityKey:[manufacturer,line,part.code||part.description,finish].join(":").toLowerCase(),required:true,
          sourceDocumentId:part.documentId||"",sourcePage:Number(part.page||0)||undefined,ruleId:part.id,technicalStatus:"verified"});
      } catch(error:any) { errors.push("Acessório "+String(part.code||part.description)+": "+String(error?.message||"fórmula inválida")); }
    }
    const grouped=new Map<string,any>();
    for(const part of bom){
      if(part.category!=="aluminum_profile"){grouped.set(part.id,part);continue;}
      const key=part.compatibilityKey;
      const existing=grouped.get(key);
      if(!existing){grouped.set(key,{...part,sourceReferences:[{documentId:part.sourceDocumentId,page:part.sourcePage,ruleId:part.ruleId}]});}
      else {
        existing.cutLengthsMm=[...(existing.cutLengthsMm||[]),...(part.cutLengthsMm||[])];
        existing.sourceReferences.push({documentId:part.sourceDocumentId,page:part.sourcePage,ruleId:part.ruleId});
      }
    }
    const finalBom=[...grouped.values()].map(part=>{
      if(part.category!=="aluminum_profile")return part;
      const cuts=[...(part.cutLengthsMm||[])].sort((a:number,b:number)=>b-a),bins:number[]=[];
      for(const cut of cuts){const kerf=Number(part.kerfMm||3);const i=bins.findIndex(used=>used+(used?kerf:0)+cut<=Number(part.commercialBarLengthMm));if(i<0)bins.push(cut);else bins[i]+=kerf+cut;}
      return {...part,quantity:bins.length,cutLengthsMm:cuts};
    });
    return res.status(200).json({manufacturer,line,typology,configuration,widthMm:width,heightMm:height,quantity,finish,bom:finalBom,
      errors,complete:errors.length===0&&finalBom.length>0,generatedAt:new Date().toISOString(),
      notice:"Somente regras, perfis e acessórios com status verified foram usados. A completude depende de a Biblioteca Técnica conter todos os componentes exigidos pelo fabricante para esta tipologia. Variáveis: W/L=largura em mm, H=altura em mm, Q=1 por esquadria. Fórmulas aceitam apenas + - * / e parênteses."});
  } catch(error:any) {
    console.error("ANACLETO BOM generation failed",error);
    return res.status(502).json({error:String(error?.message||"Falha ao gerar despiece técnico.")});
  }
}
