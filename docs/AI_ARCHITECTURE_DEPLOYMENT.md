# ANACLETO — configuração operacional da arquitetura de IA

## Segredos e variáveis obrigatórias

`GEMINI_API_KEY` (ou `GOOGLE_API_KEY`) habilita chamadas diretas ao Gemini 3.8 Flash pelo SDK oficial `@google/genai`, com `responseMimeType: application/json` e `responseSchema` nos agentes estruturados. Os fluxos de geração de imagem usam `gemini-nano-banana-2.1`. Sem a chave direta, os agentes estruturados mantêm o fallback existente pelo Vercel AI Gateway; a validação de JSON continua obrigatória na aplicação.

Quando Gemini falha ou está sobrecarregado, o pipeline tenta `OPENAI_API_KEY` direto, se existir, e depois o modelo `openai/gpt-4.1-mini` via `AI_GATEWAY_API_KEY` (configurável por `ANACLETO_AI_GATEWAY_FALLBACK_MODEL`). O fallback do CAD usa o mesmo modelo multimodal. Os renders de imagem usam Nano Banana 2.1 e, em falha, `openai/gpt-image-2.6-flare` via AI Gateway. A chave deve existir somente como variável sensível no servidor (Vercel Preview/Production), nunca em `localStorage`, no bundle do navegador ou no Git. A camada gratuita do Google tem limites e disponibilidade sujeitos à política atual do provedor; não é possível prometer uso ilimitado ou 100% de disponibilidade.

Configure no ambiente de execução (Preview e Production separadamente). Nunca coloque estes valores no frontend, no Git ou em logs.

`ANACLETO_REQUIRE_AI_AUDIT` é opcional e, por padrão, deve permanecer `false`: a IA continua funcionando se a gravação de auditoria estiver temporariamente indisponível. Defina como `true` somente depois de publicar e validar as regras append-only do Firestore para `ai_audit_logs` e `budget_line_audit`.

| Variável | Finalidade |
|---|---|
| `GEMINI_API_KEY` (ou `GOOGLE_API_KEY`) | Chave do Google AI Studio para Gemini 2.5 Flash direto com JSON Schema. Configurar como variável sensível em Preview e Production. |
| `ANACLETO_SERVICE_API_KEY` | Segredo HMAC compartilhado entre o servidor principal e o serviço independente de desenhos. Mínimo de 32 caracteres aleatórios. Deve ser idêntico nos dois serviços. |
| `ANACLETO_DRAWING_SERVICE_URL` | URL HTTPS base do serviço independente. O contrato usa `POST /api/technical-drawing` e `GET /api/technical-drawing?jobId={uuid}`. |
| `UPSTASH_REDIS_REST_URL` | Endpoint REST do Redis para limites compartilhados de uso em chat público, pré-orçamento, geração de imagem, desenho técnico e assistente financeiro. Obrigatório em produção. |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST padrão do Redis, somente no servidor. Obrigatório em produção. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON da service account para persistir auditorias originadas de chamadas públicas sem token Firebase de usuário. Alternativamente, use `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY`. |
| `ANACLETO_PUBLIC_ESTIMATE_MODEL` | Override opcional do modelo leve de pré-avaliação pública. |
| `ANACLETO_QUOTE_MODEL`, `ANACLETO_BUDGET_MODEL`, `ANACLETO_DRAWING_MODEL` | Overrides opcionais por capacidade, centralizados em `src/server/ai-config.ts`. |

## Limites de uso compartilhados\n\n- `src/server/rate-limit.ts` usa uma operação Lua atômica no Upstash Redis para aplicar janelas fixas compartilhadas entre instâncias serverless.\n- As chaves Redis armazenam somente hashes SHA-256 do identificador de usuário/IP, não o IP em texto.\n- Uma regra ativa do Vercel Firewall protege `/api/chat`, `/api/public/quote-estimate`, `/api/public/architectural-visualization` e `/api/generate-3d-render` com um limite compartilhado de 5 requisições por minuto por IP.
- O plano Vercel atual rejeitou regras adicionais de rate limit com HTTP 402; por isso os quatro endpoints públicos compartilham o mesmo limite de borda, em vez de terem quotas independentes.
- O Upstash continua opcional e fornece contadores compartilhados mais precisos por usuário/IP. Sem Redis, as quotas adicionais do servidor são limitadas por instância; a regra de borda protege os endpoints públicos. \n- Os limites são definidos por rota/capacidade no servidor e não substituem autenticação nem autorização por função.\n\n## Contrato do serviço de desenhos

1. O servidor principal gera um UUID de tarefa, serializa o corpo JSON e assina `METHOD + path + timestamp + body` com HMAC-SHA256.
2. Envia `x-service-signature`, `x-service-timestamp`, `x-request-id` e o Bearer token Firebase do utilizador.
3. O serviço independente valida a assinatura com comparação em tempo constante e rejeita timestamps com mais de 60 segundos.
4. Antes de chamar o modelo, o serviço grava `drawing_jobs/{jobId}` como `PROCESSING`.
5. Se a chamada ultrapassar 5 segundos, o servidor principal devolve HTTP 202 com `status: JOB_PROCESSING`, `jobId` e `pollUrl`.
6. A UI consulta a tarefa; o serviço grava `COMPLETED`, `COMPLETED_WITH_FALLBACK` ou `FAILED` no mesmo documento.
7. A tarefa só pode ser consultada pelo utilizador proprietário ou por perfis administrativos autorizados.

O serviço remoto precisa implementar este contrato de endpoints e compartilhar o segredo HMAC. Sem `ANACLETO_DRAWING_SERVICE_URL`, o servidor principal mantém o caminho local existente, sem proxy assíncrono remoto.

## Persistência e auditoria

- `approved_snapshots`: ledger imutável; as regras Firestore negam atualização e exclusão.
- `budget_line_audit`: transições de linha gravadas no mesmo commit atômico da aprovação.
- `ai_audit_logs`: hashes SHA-256 de entrada/saída, modelo, contagem de tokens, duração e resultado.
- O snapshot é escrito com precondição `updateTime` do documento de origem; uma aprovação concorrente falha em vez de sobrescrever outra versão.
- O PDF de um documento aprovado deve ser montado a partir de `approved_snapshots`; PDFs de rascunho permanecem explicitamente marcados e não são documentos de fabricação.

## Ativação

1. Configurar as variáveis acima no Vercel Preview.
2. Publicar as regras de `firestore.rules`.
3. Configurar as mesmas chaves no serviço remoto de desenhos.
4. Validar geração, timeout, polling, fallback, auditoria, concorrência e recuperação de snapshot em Preview.
5. Só então repetir os testes em Production.
