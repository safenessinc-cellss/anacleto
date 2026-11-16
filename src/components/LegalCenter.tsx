import React, { useEffect, useState } from "react";
import { Cookie, ShieldCheck, FileText, Scale, X, Settings2, CheckCircle2 } from "lucide-react";

type LegalDocument = "privacy" | "cookies" | "terms" | "service" | "rights";
type Props = { initialDocument?: LegalDocument; onClose: () => void; contactEmail?: string; companyName?: string };

const documents: Record<LegalDocument, { title: string; intro: string; sections: { heading: string; body: string }[] }> = {
  privacy: {
    title: "Política de Privacidade",
    intro: "Esta política explica como a Anacleto Esquadrias trata dados pessoais no site e nas ferramentas digitais de atendimento, orçamento e gestão.",
    sections: [
      { heading: "1. Quem é responsável", body: "Controlador: ANACLETO ESQUADRIAS, CNPJ 40.905.676/0001-49, com endereço na Av. Caxias do Sul, 1069, bairro Rio dos Sinos, São Leopoldo, RS, Brasil. O canal de contato para assuntos de privacidade e solicitações relacionadas à LGPD é contato@anacletoesquadrias.com.br." },
      { heading: "2. Dados que podemos tratar", body: "Podemos tratar dados de identificação e contato (nome, e-mail, telefone/WhatsApp), dados de orçamento e atendimento (endereço da obra, medidas, produtos, serviços, mensagens e agendamentos), dados fiscais e de cobrança quando necessários, e dados de acesso e segurança do sistema. No CRM, a empresa também pode registrar dados de clientes, representantes, funcionários, prestadores terceirizados e fornecedores. A empresa deve limitar os campos ao mínimo necessário e não inserir dados sensíveis sem necessidade e fundamento legal." },
      { heading: "3. Finalidades e bases legais", body: "Usamos os dados para responder solicitações, preparar orçamentos, agendar medições e visitas, executar contratos, emitir documentos e cumprir obrigações legais ou regulatórias, proteger contas e prevenir fraudes, e atender solicitações dos titulares. As bases legais aplicáveis podem incluir procedimentos preliminares e execução de contrato, cumprimento de obrigação legal, exercício regular de direitos, legítimo interesse avaliado e, quando necessário, consentimento. O consentimento para publicidade ou cookies não essenciais é separado e opcional." },
      { heading: "4. Compartilhamento e operadores", body: "Os dados podem ser processados por fornecedores que apoiam hospedagem, infraestrutura, autenticação, banco de dados, comunicação e pagamentos, conforme necessário e sob obrigações de segurança e confidencialidade. A infraestrutura atualmente prevista no projeto inclui serviços Google/Firebase e Vercel; integrações como Mercado Pago e WhatsApp somente devem receber dados quando efetivamente utilizadas. Não vendemos dados pessoais. A lista real de operadores, serviços ativados e eventuais transferências internacionais deve ser confirmada pela empresa." },
      { heading: "5. Retenção e eliminação", body: "Mantemos os dados pelo tempo necessário às finalidades informadas, à execução contratual e ao cumprimento dos prazos legais, fiscais e de defesa de direitos. Após esse período, os dados serão eliminados ou anonimizados, salvo hipóteses legais de conservação. A empresa deve definir uma tabela interna de retenção e descarte para clientes, orçamentos, documentos fiscais, funcionários e prestadores." },
      { heading: "6. Segurança", body: "Adotamos medidas técnicas e administrativas proporcionais ao risco, como controle de acesso por função, autenticação, gestão de permissões, cópias de segurança e monitoramento de eventos quando disponíveis. Nenhum sistema é absolutamente livre de riscos. Incidentes relevantes serão tratados e comunicados conforme a legislação e regulamentação aplicáveis." },
      { heading: "7. Direitos dos titulares", body: "Nos termos da LGPD, você pode solicitar confirmação e acesso, correção, anonimização, bloqueio ou eliminação quando cabível, informação sobre compartilhamentos, portabilidade nos termos da regulamentação, oposição e revisão de decisões automatizadas quando aplicável, além de revogar consentimentos. Algumas informações podem ser conservadas para cumprir obrigações legais ou exercer direitos." },
      { heading: "8. Crianças e adolescentes", body: "O site e o CRM não são direcionados a crianças. Não solicitamos intencionalmente dados de crianças. Se houver tratamento incidental, a empresa deverá avaliar o melhor interesse e as exigências específicas da LGPD." },
      { heading: "9. Alterações", body: "Esta política poderá ser atualizada para refletir mudanças nos serviços, nas operações ou na legislação. A versão vigente e a data de atualização devem ficar disponíveis nesta página." }
    ]
  },
  cookies: {
    title: "Política de Cookies",
    intro: "Cookies e tecnologias semelhantes podem armazenar preferências e apoiar o funcionamento seguro do site. O usuário pode rever suas escolhas no painel de preferências.",
    sections: [
      { heading: "1. Categorias", body: "Cookies estritamente necessários: suportam funções essenciais, segurança, sessão e preferências solicitadas. Não podem ser desativados no painel quando indispensáveis ao serviço. Cookies de desempenho/estatística: ajudam a compreender o uso do site e só devem ser ativados após escolha válida do usuário. Cookies de marketing: usados para publicidade ou medição de campanhas e também dependem de autorização prévia. No momento, o painel não ativa ferramentas de análise ou publicidade por si só; categorias opcionais permanecem desativadas até integração e consentimento." },
      { heading: "2. Escolhas do usuário", body: "Você pode aceitar todos, rejeitar os opcionais ou configurar cada categoria. A recusa de cookies não essenciais não deve impedir o acesso às funções básicas. A escolha pode ser alterada posteriormente em “Preferências de cookies” no rodapé." },
      { heading: "3. Prazo e terceiros", body: "A duração e os fornecedores dependem dos cookies efetivamente instalados e devem ser identificados após auditoria técnica do site e das integrações. Não se deve publicar uma lista de cookies ou prazos presumidos. Antes de ativar analytics, publicidade ou pixels de terceiros, a empresa deve atualizar esta política com nome, finalidade, fornecedor, duração e eventual transferência internacional." },
      { heading: "4. Como gerenciar", body: "Além deste painel, você pode apagar cookies nas configurações do navegador. Isso pode encerrar sessões e remover preferências locais." }
    ]
  },
  terms: {
    title: "Termos de Uso",
    intro: "Estes termos regulam o acesso ao site institucional e às funcionalidades públicas disponibilizadas pela Anacleto Esquadrias.",
    sections: [
      { heading: "1. Aceitação e finalidade", body: "Ao navegar no site, você concorda com estes termos. O site apresenta informações institucionais e permite solicitar contato, visita técnica e orçamento. O envio de uma solicitação não significa aceitação de proposta nem celebração automática de contrato." },
      { heading: "2. Informações e disponibilidade", body: "Fotos, descrições, medidas ilustrativas, materiais e prazos apresentados no site têm caráter informativo. A disponibilidade, especificação técnica, preço e prazo dependem de avaliação, medição, projeto e proposta formal. A empresa poderá corrigir erros materiais e atualizar conteúdos." },
      { heading: "3. Uso permitido", body: "O usuário compromete-se a fornecer informações verdadeiras, não utilizar o site para fins ilícitos, não tentar acessar áreas restritas, não comprometer a segurança e não enviar conteúdo malicioso ou dados de terceiros sem autorização ou outra base legal." },
      { heading: "4. Propriedade intelectual", body: "Marcas, logotipos, textos, imagens, layouts e materiais do site pertencem à empresa ou a seus licenciantes e não podem ser reproduzidos comercialmente sem autorização, ressalvadas as hipóteses legais." },
      { heading: "5. Links e serviços de terceiros", body: "Links e integrações de terceiros podem estar sujeitos a termos e políticas próprios. A empresa não controla integralmente serviços externos." },
      { heading: "6. Responsabilidade e legislação", body: "Nada nestes termos exclui direitos obrigatórios previstos na legislação brasileira, especialmente no Código de Defesa do Consumidor quando aplicável. Eventuais controvérsias serão tratadas conforme a legislação brasileira e as regras de competência aplicáveis." }
    ]
  },
  service: {
    title: "Condições de Orçamento e Contratação",
    intro: "As condições específicas de cada fornecimento ou instalação devem constar da proposta comercial e do contrato aceito pelas partes.",
    sections: [
      { heading: "1. Solicitação e visita técnica", body: "Solicitações enviadas pelo site são preliminares. Medidas, condições da obra, materiais, ferragens, acabamento, instalação e logística podem exigir visita e validação técnica." },
      { heading: "2. Proposta comercial", body: "A proposta formal deverá identificar escopo, especificações, quantidades, preço, validade, forma e etapas de pagamento, prazo estimado, responsabilidades de preparação da obra, entrega e instalação, garantia e condições de alteração ou cancelamento." },
      { heading: "3. Aprovação e alterações", body: "A contratação ocorre após aceite expresso da proposta e formalização exigida para o caso. Alterações de medidas, materiais, escopo ou condições da obra podem alterar preço e prazo e devem ser aprovadas por escrito." },
      { heading: "4. Pagamentos, entrega e instalação", body: "Valores, vencimentos, meios de pagamento, emissão de documentos fiscais, cronograma, acesso ao local e critérios de conclusão devem ser definidos na proposta/contrato. Não envie dados completos de cartão ou senhas por formulários, e-mail ou WhatsApp." },
      { heading: "5. Garantias e atendimento", body: "Garantias legais e contratuais serão respeitadas. Prazos, exclusões legítimas, manutenção e canal de assistência devem constar da documentação entregue ao cliente. Esta página não substitui a proposta ou contrato individual." }
    ]
  },
  rights: {
    title: "Canal de Privacidade e Direitos LGPD",
    intro: "Para exercer seus direitos ou esclarecer dúvidas sobre dados pessoais, entre em contato pelo canal oficial indicado pela empresa.",
    sections: [
      { heading: "Como solicitar", body: "Informe seu nome, meio de contato, a relação com a empresa e o pedido (por exemplo, acesso, correção ou eliminação). Não envie documentos excessivos. A empresa poderá solicitar confirmação proporcional de identidade para evitar divulgação indevida." },
      { heading: "Prazos e limitações", body: "As solicitações serão analisadas e respondidas nos prazos previstos na LGPD e na regulamentação da ANPD. A eliminação pode não ser possível quando a conservação for necessária para obrigação legal, regulatória, contrato ou exercício regular de direitos; nesses casos, a justificativa será informada." },
      { heading: "Contato", body: "Canal LGPD: contato@anacletoesquadrias.com.br. As solicitações serão encaminhadas à equipe responsável pela privacidade da ANACLETO ESQUADRIAS. A empresa deverá formalizar a designação de encarregado quando exigida ou aplicável e manter este canal atualizado." }
    ]
  }
};

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [settings, setSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    try { setVisible(!localStorage.getItem("anacleto_cookie_consent_v1")); } catch { setVisible(false); }
    const openSettings = () => { setSettings(true); setVisible(true); };
    window.addEventListener("anacleto:cookie-settings", openSettings);
    return () => window.removeEventListener("anacleto:cookie-settings", openSettings);
  }, []);

  const save = (a: boolean, m: boolean) => {
    const choice = { necessary: true, analytics: a, marketing: m, savedAt: new Date().toISOString(), version: 1 };
    try { localStorage.setItem("anacleto_cookie_consent_v1", JSON.stringify(choice)); } catch {}
    setVisible(false); setSettings(false);
  };

  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-5">
      <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl text-slate-800">
        <div className="flex items-start gap-3">
          <Cookie className="mt-1 h-6 w-6 shrink-0 text-blue-600" />
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-base">Suas preferências de cookies</h2>
            <p className="mt-1 text-sm text-slate-600">Utilizamos cookies necessários para o funcionamento. Cookies opcionais de análise e marketing ficam desativados até sua escolha. Você pode aceitar, rejeitar ou personalizar.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button onClick={() => save(false, false)} className="rounded-lg border px-4 py-2 font-semibold">Rejeitar opcionais</button>
              <button onClick={() => { setSettings(!settings); }} className="rounded-lg border px-4 py-2 font-semibold">Personalizar</button>
              <button onClick={() => save(true, true)} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Aceitar todos</button>
            </div>
            {settings && <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3">
              <div><p className="text-sm font-semibold">Necessários</p><p className="text-xs text-slate-500">Sempre ativos para funções essenciais.</p><span className="text-xs font-bold text-emerald-700">Ativos</span></div>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={analytics} onChange={e => setAnalytics(e.target.checked)} /><span><b>Estatística</b><small className="block text-xs text-slate-500">Medição de uso, se integrada.</small></span></label>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} /><span><b>Marketing</b><small className="block text-xs text-slate-500">Publicidade, se integrada.</small></span></label>
              <button onClick={() => save(analytics, marketing)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white sm:col-span-3">Salvar minhas escolhas</button>
            </div>}
            <p className="mt-3 text-xs text-slate-500">Consulte a Política de Cookies e a Política de Privacidade no rodapé do site.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LegalCenter({ initialDocument = "privacy", onClose, contactEmail = "contato@anacletoesquadrias.com.br", companyName = "Anacleto Esquadrias" }: Props) {
  const [active, setActive] = useState<LegalDocument>(initialDocument);
  const doc = documents[active];
  const nav: { id: LegalDocument; label: string; icon: React.ReactNode }[] = [
    { id: "privacy", label: "Privacidade", icon: <ShieldCheck size={16} /> },
    { id: "cookies", label: "Cookies", icon: <Cookie size={16} /> },
    { id: "terms", label: "Termos de uso", icon: <FileText size={16} /> },
    { id: "service", label: "Orçamentos e contratação", icon: <Scale size={16} /> },
    { id: "rights", label: "Direitos LGPD", icon: <CheckCircle2 size={16} /> }
  ];
  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Central jurídica">
      <div className="mx-auto my-4 max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b px-5 py-4 sm:px-7">
          <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Central jurídica</p><h2 className="text-xl font-bold text-slate-900">{companyName}</h2></div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-xl border p-2 text-slate-600 hover:bg-slate-50"><X size={20} /></button>
        </header>
        <div className="grid md:grid-cols-[240px_1fr]">
          <nav className="flex gap-2 overflow-x-auto border-b p-3 md:flex-col md:border-b-0 md:border-r md:p-4">
            {nav.map(item => <button key={item.id} onClick={() => setActive(item.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${active === item.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>{item.icon}{item.label}</button>)}
          </nav>
          <article className="max-h-[72vh] overflow-y-auto p-5 sm:p-8">
            <h1 className="text-2xl font-bold text-slate-900">{doc.title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{doc.intro}</p>
            <p className="mt-3 text-xs text-slate-500">Última atualização: 16 de novembro de 2026</p>
            <div className="mt-7 space-y-6">{doc.sections.map(section => <section key={section.heading}><h3 className="font-bold text-slate-900">{section.heading}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{section.body}</p></section>)}</div>
            <div className="mt-8 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600"><b>Contato geral:</b> {contactEmail}<br /><span className="text-xs">Para pedidos relacionados à privacidade e à LGPD, escreva para este endereço.</span></div>
          </article>
        </div>
      </div>
    </div>
  );
}
