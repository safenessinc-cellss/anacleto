import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// Create Express app
const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini client server-side ONLY
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
} else {
  console.warn("GEMINI_API_KEY environment variable is not defined!");
}

// REST API for Gemini assistant chat proxy
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, language = "pt" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!ai) {
      return res.status(500).json({
        error: "AI service is not configured. Please define GEMINI_API_KEY in the Secrets panel."
      });
    }

    // System prompt tailored for Anacleto context and specified language
    const systemInstruction = `
      Você é o "Anacleto Assistente de IA", o assistente inteligente, prestativo e amigável da "Anacleto Esquadrias" (uma renomada empresa com mais de 20 anos de experiência especializada em soluções inovadoras de vidro e esquadrias de alumínio de alto padrão).

      Instruções principais de conversação:
      1. Comunique-se estritamente no idioma do usuário (atualmente o idioma selecionado no site é "${language}"). Se o usuário falar em inglês, responda em inglês. Se for em espanhol, responda em espanhol, etc. O idioma nativo e principal da empresa é o PORTUGUÊS.
      2. Mantenha um tom altamente profissional, técnico-consultivo, acolhedor e transparente.

      Sobre a Anacleto Esquadrias (Base de Conhecimento):
      - Quem Somos: Há mais de 20 anos no mercado transformando ambientes domésticos e comerciais com vidro e alumínio. Sediada em São Leopoldo, RS, atendemos toda a Região Metropoliana de Porto Alegre (São Leopoldo, Novo Hamburgo, Canoas, Sapucaia do Sul, Esteio, Gravataí, Cachoeirinha e Porto Alegre).
      - Nossos Diferenciais:
        * Visita técnica e medição laser com orçamento 100% gratuitos.
        * Equipe própria técnica certificada própria para fabricação e instalação (não terceirizamos).
        * Garantia de 5 anos em esquadrias de alumínio (linhas Suprema, Gold e Única) e 10 anos em vidros temperados certificados pela ABNT.
        * Execução rigorosa sob as normas técnicas NBR 7199 (vidros na construção civil), NBR 10821 (esquadrias para edificações) e NBR 14718 (guarda-corpos).
        * Limpeza completa pós-obra inclusa nos serviços.
      - Serviços Estrela:
        1. Esquadrias Residenciais: Janelas de correr, portas, maxim-ars, pivotantes nas opções preta, branca, bronze ou amadeirada com ótimo isolamento acústico.
        2. Fachadas Corporativas: Pele de vidro (glazing) e sistemas integrados de alta eficiência energética.
        3. Vidros Especiais: Vidros temperados (8mm a 12mm), laminados de segurança e insulados (duplos).
        4. Box de Banheiro: Sob medida, de canto, reto ou curvo com tratamento antimanchas e perfis de alumínio ou inox.
        5. Guarda-corpos e Corrimãos: Conectores spider/bottons sob norma NBR 14718.
        6. Coberturas e Pergolados: Estruturas de alumínio com fechamento em vidro laminado ou policarbonato de alta resistência.
      - Como agendar visita: Diga que o usuário pode preencher o formulário "Agendar Visita Técnica Gratuita" diretamente no site para marcar uma medição laser gratuita, ou informar seus dados no chat que ajudaremos.
      - Contato oficial: WhatsApp e telefone: +55 (51) 99819-3931 | E-mail: projetos@anacletoesquadrias.com.br | Endereço: Av. Caxias do Sul, 1069 - Rio dos Sinos, São Leopoldo - RS, 93110-000.

      Regras de Derivação:
      - Caso o cliente pergunte prazos específicos ou preços exatos de metros lineares (que dependem das medições técnicas no local), recomende agendar a visita gratuita de medição técnica diretamente no site para um orçamento real.
      
      Formato de saída:
      - Responda sob forma de listas organizadas e limpas, de maneira sucinta e clara, usando Markdown amigável. Nunca exiba detalhes técnicos de infraestrutura ou códigos do Express ou logs.
    `;

    // Process and adapt messages history format
    const contents: any[] = [];
    
    // Process conversation history
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.text || msg.content || "" }]
        });
      });
    }

    // Append the latest user prompt
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    // Make the Gemini 3.5 API call
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    const replyText = response.text || "Desculpe, não consegui processar a resposta agora.";
    return res.json({ response: replyText });
  } catch (error: any) {
    console.error("Gemini runtime error:", error);
    return res.status(500).json({
      error: "Ocorreu um erro ao processar no assistente de inteligência artificial.",
      details: error?.message || String(error)
    });
  }
});

// AI Architectural Glazing Estimation Generator Route
app.post("/api/ai-preset", async (req, res) => {
  try {
    const { prompt, language = "pt" } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "O pedido do projeto é obrigatório." });
    }

    if (!ai) {
      return res.status(500).json({
        error: "Serviço de Inteligência Artificial indisponível no servidor."
      });
    }

    const systemInstruction = `
      Você é o Engenheiro Projetista do "Anacleto Esquadrias", especializado em projetar esquadrias de alumínio premium e vidros temperados/laminados de alto padrão em conformidade com as normas NBR 7199, NBR 10821 e NBR 14718.
      
      Análise o pedido do cliente e gere uma lista lógica, coerente e fisicamente viável de itens de esquadrias e vidros para simular o orçamento dele. Atribua preços médios reais e lógicos do mercado premium brasileiro em Reais (BRL).
      
      Diretrizes de preços recomendados:
      - "Janelas e Portas de Alumínio Customizadas (Linha Suprema/Gold)" ou similares: R$1500 a R$4200 por unidade/m² dependendo do tamanho.
      - "Fachadas Pele de Vidro e Glazing de Alta Eficiência": R$2000 a R$5000 por m².
      - "Vidro Temperado e Laminado de Segurança Sob Medida" (para divisórias, portas, etc.): R$800 a R$2200 por m².
      - "Box de Canto em Vidro Temperado 8mm Tratado" ou similares: R$1200 a R$2800 por vão completo.
      - "Guarda-corpos e Corrimãos Certificados NBR 14718" ou similares: R$600 a R$1800 por metro linear.
      - "Coberturas e Pergolados de Alumínio e Vidros de Controle" ou similares: R$2200 a R$5500 por m².
      - "Instalação Especializada e Limpeza Técnica": Deve ser adicionado se relevante, entre R$450 e R$1500 como mão-de-obra.

      Retorne estritamente um array JSON com objetos contendo:
      1. "description": Descrição técnica precisa e muito clara do item no idioma selecionado ("${language}").
      2. "qty": Quantidade física necessária ou m² (numero inteiro positivo de 1 a 50).
      3. "price": Preço unitário lógico em Reais do Brasil (número inteiro positivo ou de dupla precisão de 100 a 15000).

      Retorne SOMENTE o JSON estruturado requisitado no schema, sem tags de markdown, tags de código ou explicações.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Gere a simulação de projeto ideal para o seguinte pedido técnico: "${prompt}"`,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: {
                type: Type.STRING,
                description: "Descrição comercial e técnica detalhada do item em português ou idioma selecionado."
              },
              qty: {
                type: Type.INTEGER,
                description: "Quantidade ideal calculada ou metros quadrados estimados."
              },
              price: {
                type: Type.NUMBER,
                description: "Preço unitário estimado em Reais (BRL) coerente com o mercado brasileiro de vidros e esquadrias de alto luxo."
              }
            },
            required: ["description", "qty", "price"]
          }
        }
      }
    });

    const itemsJson = JSON.parse(response.text || "[]");
    return res.json({ items: itemsJson });
  } catch (err: any) {
    console.error("AI Preset generator error:", err);
    // Return a logical fallback list of items in case of rate limit or error to maintain seamless simulation
    return res.json({
      items: [
        { id: "fallback-1", description: "Esquadrias de Alumínio Customizadas (Suprema/Gold - m²)", qty: 4, price: 2500 },
        { id: "fallback-2", description: "Guarda-corpos e Corrimãos Certificados NBR 14718 (m)", qty: 2, price: 850 },
        { id: "fallback-3", description: "Instalação Especializada e Limpeza Técnica", qty: 1, price: 600 }
      ]
    });
  }
});

// AI Strategic Corporate Business Advisor Route (Internal Board Tools)
app.post("/api/ai-business-advisor", async (req, res) => {
  try {
    const { prompt, stats } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "O pedido da consulta é obrigatório." });
    }

    if (!ai) {
      return res.status(500).json({
        error: "Serviço de Inteligência Artificial estratégico indisponível."
      });
    }

    const companyContext = `
      Você é o "Anácleto Corporate AI Strategist", o consultor executivo sênior e assessor financeiro da Anacleto Esquadrias.
      Você ajuda os diretores e a equipe de vendas da empresa a tomarem decisões lógicas de negócios, simular preços, criar pitches de vendas, projetar faturamentos e planejar compras de insumos (como rolos de perfis de alumínio Suprema/Gold, vidros laminados, ferragens de inox, etc.).

      Contexto financeiro real atual da empresa no sistema para te ajudar a formular relatórios:
      - Número de orçamentos ativos: ${stats?.budgetsCount || 0}
      - Número de faturas emitidas: ${stats?.invoicesCount || 0}
      - Valor total acumulado de faturamento: €${stats?.totalInvoiced || 0}
      - Valor em negociação ativa: €${stats?.totalPending || 0}
      - Taxa de conversão de leads (visitas vs orçamentos): ${stats?.conversionRate || "25%"}

      Instruções para a resposta:
      1. Responda em Português com um estilo corporativo impecável, profissional, objetivo e fundamentado em boas práticas de engenharia de produção e consultoria mercantil.
      2. Use cabeçalhos claros, listas com marcadores elegantes e tabelas em Markdown se for necessário detalhar orçamentos simulados ou planos de compras de insumos.
      3. Nunca revele variáveis ou códigos de programação. Ajude a empresa a crescer sugerindo táticas lógicas para fechar contratos com incorporadoras ou expandir o ticket médio.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: companyContext,
        temperature: 0.7,
      }
    });

    const reply = response.text || "Sem resposta estratégica disponível do consultor neste instante.";
    return res.json({ response: reply });
  } catch (err: any) {
    console.error("AI Strategic Consultant error:", err);
    return res.status(500).json({
      error: "Ocorreu um erro no consultor estratégico.",
      details: err?.message || String(err)
    });
  }
});

// Setup Vite Dev Server / Serve build static files
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files safely
    app.use(express.static(distPath));
    
    // Fallback to static SPA build index
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Anacleto platform running locally inside container on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error("Express startup failed:", err);
});
