export interface CNPJData {
  cnpj: string; razao_social: string; nome_fantasia?: string; logradouro?: string;
  numero?: string; complemento?: string; bairro?: string; municipio?: string; uf?: string;
  cep?: string; ddd_telefone_1?: string; email?: string; descricao_situacao_cadastral?: string;
}
export function cleanCNPJ(cnpj: string): string { return cnpj.replace(/\D/g, ""); }
export function formatCNPJ(cnpj: string): string {
  const c = cleanCNPJ(cnpj);
  return c.length !== 14 ? cnpj : `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`;
}
async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}
export async function lookupCNPJ(cnpj: string): Promise<CNPJData> {
  const clean = cleanCNPJ(cnpj);
  if (clean.length !== 14) throw new Error("CNPJ deve ter 14 dígitos.");
  const errors: string[] = [];
  try {
    const d = await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (d?.razao_social) return {
      cnpj: d.cnpj || clean, razao_social: d.razao_social, nome_fantasia: d.nome_fantasia,
      logradouro: d.logradouro, numero: d.numero, complemento: d.complemento, bairro: d.bairro,
      municipio: d.municipio, uf: d.uf, cep: d.cep, ddd_telefone_1: d.ddd_telefone_1,
      email: d.email, descricao_situacao_cadastral: d.descricao_situacao_cadastral
    };
    errors.push("BrasilAPI: dados incompletos");
  } catch (e) { errors.push("BrasilAPI: " + (e as Error).message); }
  try {
    const d = await fetchJson(`https://publica.cnpj.ws/cnpj/${clean}`);
    const e = d?.estabelecimento || {}, a = e.endereco || {};
    if (d?.razao_social) return {
      cnpj: clean, razao_social: d.razao_social, nome_fantasia: e.nome_fantasia || "",
      logradouro: a.logradouro, numero: a.numero, complemento: a.complemento, bairro: a.bairro,
      municipio: a.cidade?.nome, uf: a.estado?.sigla, cep: a.cep,
      ddd_telefone_1: [e.ddd1, e.telefone1].filter(Boolean).join(""), email: e.email,
      descricao_situacao_cadastral: e.situacao_cadastral
    };
    errors.push("CNPJ.ws: dados incompletos");
  } catch (e) { errors.push("CNPJ.ws: " + (e as Error).message); }
  throw new Error("Não foi possível consultar o CNPJ. " + errors.join(" · ") + ". Confira o número ou tente novamente mais tarde.");
}
export function cnpjToSupplier(d: CNPJData) {
  const address = [d.logradouro, d.numero, d.complemento, d.bairro,
    d.municipio && d.uf ? `${d.municipio}/${d.uf}` : d.municipio,
    d.cep ? `CEP ${d.cep}` : ""].filter(Boolean).join(", ");
  return {
    name: d.nome_fantasia || d.razao_social || "", legalName: d.razao_social || "",
    nif: formatCNPJ(d.cnpj), email: d.email || "", phone: d.ddd_telefone_1 || "",
    address, notes: d.descricao_situacao_cadastral ? `Situação cadastral: ${d.descricao_situacao_cadastral}` : "",
    cnpjLookupAt: new Date().toISOString(), cnpjLookupSource: "BrasilAPI/CNPJ.ws"
  };
}
