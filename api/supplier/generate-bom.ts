import firebaseConfig from "../../firebase-applet-config.json" with { type: "json" };

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
  const response = await fetch(url, { headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("Não foi possível consultar " + collection + " na Ficha Técnica.");
  const data: any = await response.json();
  return (data.documents || []).map(decodeDoc) as FirestoreDoc[];
}

/** Small arithmetic parser. No eval, property access, calls, or arbitrary JavaScript. */
function evaluateFormula(source: string, vars: Record<string, number>): number {
  const tokens = source.match(/[A-Za-z_][A-Za-z0-9_]*|(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/]/g) || [];
  if (!tokens.length || tokens.join("") !== source.replace(/\s+/g, "")) throw new Error("Fórmula contém caracteres não permitidos.");
  let index = 0;
  const expression = (): number => {
    let value = term();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const op = tokens[index++];
      const rhs = term();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  };
  const term = (): number => {
    let value = factor();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const op = tokens[index++];
      const rhs = factor();
      if (op === "/" && rhs === 0) throw new Error("Divisão por zero na fórmula.");
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  };
  const factor = (): number => {
    const token = tokens[index++];
    if (token === "+" || token === "-") {
      const value = factor();
      return token === "-" ? -value : value;
    }
    if (token === "(") {
      const value = expression();
      if (tokens[index++] !== ")") throw new Error("Parênteses não fechados na fórmula.");
      return value;
    }
    if (!token) throw new Error("Fórmula incompleta.");
    if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) return Number(token);
    const key = token.toUpperCase();
    if (!(key in vars)) throw new Error("Variável não permitida na fórmula: " + token);
    return vars[key];
  };
  const result = expression();
  if (index !== tokens.length || !Number.isFinite(result) || result <= 0) throw new Error("Resultado inválido na fórmula.");
  return result;
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
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(10000)
    });
    if (!auth.ok) return res.status(401).json({error:"Sessão inválida."});
    const identity:any=await auth.json(), user=identity.users?.[0];
    if (!user?.localId || !user?.email) return res.status(401).json({error:"Usuário não autenticado."});
    const databaseId= firebaseConfig.firestoreDatabaseId || "(default)";
    if (String(user.email).toLowerCase() !== OWNER_EMAIL) {
      const admins=await collectionDocs(firebaseConfig.projectId,databaseId,"admins",token);
      const admin=admins.find(row=>String(row.id).toLowerCase()===String(user.email).toLowerCase());
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
      const profile=profilePool.find(row=>eq(row.code,String(rule.profileCode||"")));
      if(!profile) { errors.push("Perfil " + String(rule.profileCode||"(sem código)") + " sem cadastro verificado compatível."); continue; }
      const vars={W:width,H:height,L:width,Q:quantity};
      try {
        const isProfile=String(rule.category||"aluminum_profile")==="aluminum_profile";
        const unit=String(rule.unit||(isProfile?"bar":"piece"));
        const calculated=evaluateFormula(String(rule.formula||""),vars);
        const commercialLength=Number(profile.commercialLengthMm||0);
        const perProduct=rule.quantityFormula?evaluateFormula(String(rule.quantityFormula),vars):Number(rule.cutCount||1);
        if(!Number.isFinite(perProduct)||perProduct<=0||perProduct>1000) throw new Error("Quantidade de cortes/consumo inválida.");
        let cuts:number[]|undefined;
        let count:number;
        if(isProfile) {
          if(!commercialLength) { errors.push("Perfil "+profile.code+": comprimento comercial não verificado."); continue; }
          const cutLength=calculated;
          if(cutLength>commercialLength) throw new Error("Corte maior que a barra comercial.");
          cuts=Array.from({length:Math.ceil(perProduct*quantity)},()=>cutLength);
          const bars:number[][]=[];
          for(const cut of [...cuts].sort((a,b)=>b-a)) {
            let target=bars.find(bar=>bar.reduce((sum,n)=>sum+n,0)+bar.length*Number(rule.kerfMm||3)+cut<=commercialLength);
            if(!target){target=[];bars.push(target);}
            target.push(cut);
          }
          count=bars.length;
        } else {
          count=roundQty(calculated*perProduct*quantity,unit);
        }
        bom.push({
          id:String(rule.id),category:rule.category||"aluminum_profile",code:String(profile.code),
          description:String(profile.description||rule.description||profile.code),quantity:count,
          unit:isProfile?"bar":unit,cutLengthsMm:cuts,
          commercialBarLengthMm:isProfile?commercialLength:undefined,kerfMm:Number(rule.kerfMm||3),
          manufacturer,system:line,finish:finish||profile.finish||"",compatibilityKey:[manufacturer,line,profile.code,finish||profile.finish||""].join(":").toLowerCase(),
          required:true,sourceDocumentId:rule.documentId||profile.documentId||"",sourcePage:Number(rule.page||profile.page||0)||undefined,
          ruleId:rule.id,technicalStatus:"verified",formula:rule.formula
        });
      } catch(error:any) { errors.push("Regra "+String(rule.id)+": "+String(error?.message||"fórmula inválida")); }
    }
    const matchingHardware=hardware.filter(row=>verified(row)&&eq(row.manufacturer,manufacturer)&&eq(row.line,line)&&(!row.typology||eq(row.typology,typology))&&(!row.finish||!finish||eq(row.finish,finish)));
    for(const part of matchingHardware) {
      if(!part.quantityFormula && !Number.isFinite(Number(part.quantity))) {
        errors.push("Acessório "+String(part.code||part.description)+" sem quantidade ou fórmula de consumo verificada.");
        continue;
      }
      try {
        const raw=part.quantityFormula?evaluateFormula(String(part.quantityFormula),{W:width,H:height,L:width,Q:quantity}):Number(part.quantity);
        bom.push({id:String(part.id),category:"hardware",code:String(part.code||""),description:String(part.description||part.code||"Acessório"),
          quantity:roundQty(raw*quantity,String(part.unit||"piece")),unit:String(part.unit||"piece"),manufacturer,system:line,finish,
          compatibilityKey:[manufacturer,line,part.code||part.description,finish].join(":").toLowerCase(),required:true,
          sourceDocumentId:part.documentId||"",sourcePage:Number(part.page||0)||undefined,ruleId:part.id,technicalStatus:"verified"});
      } catch(error:any) { errors.push("Acessório "+String(part.code||part.description)+": "+String(error?.message||"fórmula inválida")); }
    }
    return res.status(200).json({manufacturer,line,typology,configuration,widthMm:width,heightMm:height,quantity,finish,bom,
      errors,complete:errors.length===0&&bom.length>0,generatedAt:new Date().toISOString(),
      notice:"Somente regras, perfis e acessórios com status verified foram usados. Variáveis permitidas: W/L=largura em mm, H=altura em mm, Q=quantidade. Fórmulas aceitam apenas + - * / e parênteses."});
  } catch(error:any) {
    console.error("ANACLETO BOM generation failed",error);
    return res.status(502).json({error:String(error?.message||"Falha ao gerar despiece técnico.")});
  }
}
