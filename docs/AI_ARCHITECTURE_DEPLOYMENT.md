# ANACLETO — configuração operacional da arquitetura de IA

## Segredos e variáveis obrigatórias

Configure no ambiente de execução (Preview e Production separadamente). Nunca coloque estes valores no frontend, no Git ou em logs.

| Variável | Finalidade |
|---|---|
| `ANACLETO_SERVICE_API_KEY` | Segredo HMAC compartilhado entre o servidor principal e o serviço independente de desenhos. Mínimo de 32 caracteres aleatórios. Deve ser idêntico nos dois serviços. |
| `ANACLETO_DRAWING_SERVICE_URL` | URL HTTPS base do serviço independente. O contrato usa `POST /api/technical-drawing` e `GET /api/technical-drawing?jobId={uuid}`. |
| `UPSTASH_REDIS_REST_URL` | Endpoint REST do Redis para rate limit distribuído do endpoint público. Obrigatório em produção. |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST do Redis. Obrigatório em produção. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON da service account para persistir auditorias originadas de chamadas públicas sem token Firebase de usuário. Alternativamente, use `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY`. |
| `ANACLETO_PUBLIC_ESTIMATE_MODEL` | Override opcional do modelo leve de pré-avaliação pública. |
| `ANACLETO_QUOTE_MODEL`, `ANACLETO_BUDGET_MODEL`, `ANACLETO_DRAWING_MODEL` | Overrides opcionais por capacidade, centralizados em `src/server/ai-config.ts`. |

## Contrato do serviço de desenhos

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
