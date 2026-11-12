# ANACLETO — configuração operacional da arquitetura de IA

## Runtime atual

A aplicação utiliza exclusivamente os endpoints internos do projeto:
- `server.ts` é exportado por `api/index.ts` para as rotas HTTP.
- `api/technical-drawing.ts` gera desenhos técnicos localmente com Three.js/SVG no cliente; não existe dependência de um serviço CAD remoto.
- Não existe dependência de Redis ou Upstash. Os limites de uso são mantidos em mapas temporários em memória por instância serverless; eles reduzem abuso, mas não representam uma quota global distribuída.
- O desenho técnico mantém um fallback local marcado como rascunho preliminar. Nenhum fallback deve ser tratado como desenho aprovado para fabricação.

## Variáveis de IA

Configure apenas no ambiente do servidor (Vercel Preview e Production). Nunca coloque chaves no bundle, em `localStorage`, no Git ou em logs.

| Variável | Finalidade |
|---|---|
| `AI_GATEWAY_API_KEY` | Chave do Vercel AI Gateway para as capacidades de chat, orçamento, extração e desenho. |
| `GEMINI_API_KEY` | Alternativa direta ao Gemini 2.5 Flash pelo SDK oficial. |
| `GOOGLE_API_KEY` | Nome alternativo aceito para a chave direta do Google AI. |
| `ANACLETO_AI_MODEL` | Override opcional do modelo padrão no Vercel AI Gateway. |
| `ANACLETO_CHAT_MODEL`, `ANACLETO_QUOTE_MODEL`, `ANACLETO_BUDGET_MODEL`, `ANACLETO_DRAWING_MODEL`, `ANACLETO_DOCUMENT_MODEL` | Overrides opcionais por capacidade, centralizados em `src/server/ai-config.ts`. |
| `ANACLETO_REQUIRE_AI_AUDIT` | Opcional; mantenha `false` até validar as regras append-only das coleções de auditoria. |

A inicialização do provedor ocorre somente quando uma requisição chama uma capacidade de IA. Se o provedor falhar ou não estiver configurado, os endpoints que possuem fallback respondem com resultados locais explicitamente identificados. A disponibilidade e os limites gratuitos do provedor externo dependem das políticas dele; não é possível prometer disponibilidade ilimitada.

## Catálogos de fornecedores

O importador lê texto de PDF no navegador com `pdfjs-dist`, mostra miniaturas das páginas e envia apenas o texto extraído ao endpoint autenticado `/api/ai/catalog-extract`. A resposta estruturada é revisável antes da gravação em `supplier_catalog`. PDFs digitalizados sem camada de texto precisam de OCR externo ou conversão prévia; o sistema não deve inventar conteúdo que não conseguiu ler.

## Persistência e auditoria

- `approved_snapshots`: ledger imutável; as regras Firestore negam atualização e exclusão.
- `budget_line_audit`: transições de linha gravadas no fluxo de aprovação.
- `ai_audit_logs`: hashes de entrada/saída, modelo, contagem de tokens, duração e resultado.
- O PDF de um documento aprovado deve ser montado a partir de `approved_snapshots`; PDFs de rascunho permanecem explicitamente marcados e não são documentos de fabricação.

## Ativação e validação

1. Configurar `AI_GATEWAY_API_KEY` ou `GEMINI_API_KEY` como variável sensível no Vercel.
2. Publicar as regras atualizadas de `firestore.rules` no Firebase Console.
3. Executar `npm run lint` e `npm run build`.
4. Validar em Preview chat público, importação PDF/CSV, geração técnica, fallback, auditoria e persistência.
5. Só então promover o commit testado para Production.
