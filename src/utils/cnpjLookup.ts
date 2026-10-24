/**
 * Busca datos de un CNPJ usando BrasilAPI (gratis, sin auth, CORS abierto)
 * https://brasilapi.com.br/docs#tag/CNPJ
 */
export interface CNPJData {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  ddd_telefone_1?: string;
  email?: string;
  descricao_situacao_cadastral?: string;
}

export function cleanCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

export function formatCNPJ(cnpj: string): string {
  const c = cleanCNPJ(cnpj);
  if (c.length !== 14) return cnpj;
  return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`;
}

export async function lookupCNPJ(cnpj: string): Promise<CNPJData> {
  const clean = cleanCNPJ(cnpj);
  if (clean.length !== 14) {
    throw new Error("CNPJ deve ter 14 dígitos (recebido: " + clean.length + ")");
  }
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("CNPJ não encontrado na Receita Federal");
    throw new Error(`Erro ao buscar CNPJ (${res.status})`);
  }
  return (await res.json()) as CNPJData;
}

export function cnpjToSupplier(cnpjData: CNPJData) {
  const endereco = [
    cnpjData.logradouro,
    cnpjData.numero,
    cnpjData.complemento,
    cnpjData.bairro,
    cnpjData.municipio && cnpjData.uf ? `${cnpjData.municipio}/${cnpjData.uf}` : cnpjData.municipio,
    cnpjData.cep ? `CEP ${cnpjData.cep}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return {
    name: cnpjData.razao_social || cnpjData.nome_fantasia || "",
    nif: formatCNPJ(cnpjData.cnpj),
    email: cnpjData.email || "",
    phone: cnpjData.ddd_telefone_1 || "",
    address: endereco,
    notes: cnpjData.descricao_situacao_cadastral
      ? `Situação: ${cnpjData.descricao_situacao_cadastral}`
      : "",
  };
}
