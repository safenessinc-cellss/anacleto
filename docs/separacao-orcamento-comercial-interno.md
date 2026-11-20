# Separação entre orçamento comercial e custos internos

## Objetivo

Um projeto técnico e uma revisão aprovada alimentam duas visões distintas:

- **Orçamento do cliente (coleção quotes)**: preço de venda, escopo, especificações que o cliente precisa conhecer, condições comerciais e PDF/proposta.
- **Ficha interna de custos (coleção internal_quote_costs)**: custos reais, fornecedores, códigos internos, consumo, frete, mão de obra, instalação, desperdício e formação do preço. Nunca é incluída no PDF/proposta do cliente.

A ficha interna referencia quoteId e revisionKey. A revisão usa, por ordem, approvedSnapshotId, snapshotContentHash, updatedAt ou createdAt. Uma alteração no orçamento gera outra chave de revisão; a ficha antiga é preservada e não é sobrescrita.

## Formação do preço

A ficha interna suporta dois métodos distintos:

- Markup: preço sugerido = custo total × (1 + percentual / 100).
- Margem sobre venda: preço sugerido = custo total / (1 - percentual / 100).

Margem sobre venda deve ser inferior a 100%. O resultado bruto estimado é preço sugerido menos custo total. Tributos, despesas administrativas e regras fiscais não são presumidos: devem ser parametrizados e validados pelo responsável contábil antes de integrarem o preço final.

O preço sugerido é apenas uma apuração interna. Não altera automaticamente o orçamento comercial nem qualquer documento enviado ao cliente.

## Segurança

A coleção internal_quote_costs é protegida por canManageFinance() nas regras Firestore. Isso inclui o proprietário exclusivo (safeness.c.a@gmail.com) e perfis financeiros/administrativos já autorizados pela política de roles. Perfis comerciais comuns e clientes não têm acesso à coleção.

A navegação interna é exibida apenas a super_admin, super_usuario, ceo, admin e financeiro. Ocultar a aba não substitui as regras Firestore: a autorização real está na camada de dados.

## Estado da implementação e limites

Implementado nesta etapa:
- aba confidencial Orçamentos Internos (Custos) no grupo Financeiro;
- seleção de orçamento comercial existente;
- ficha de custos por revisão, com preservação de revisões anteriores;
- linhas para alumínio, vidro, ferragens, consumíveis, mão de obra, instalação, frete e outros;
- fornecedor, código, unidade, quantidade e custo unitário;
- cópia opcional das linhas comerciais como rascunho de custos, com custo zerado para preenchimento manual;
- cálculo separado de markup e margem;
- regras Firestore restritas.

Ainda requer integração e validação específica:
- transferir a BOM técnica gerada para a ficha interna sem copiar custos para quotes;
- importar automaticamente as cestas de fornecedores verificadas e os preços aprovados;
- transformar custos aprovados em pedidos de compra, reservas/baixas de estoque e custos reais de produção com idempotência;
- parametrizar tributos, despesas indiretas e mão de obra conforme a realidade fiscal/operacional da empresa;
- testar o percurso completo com um orçamento real e uma ficha técnica oficial.

## Publicação

A alteração de firestore.rules precisa ser publicada manualmente no Firebase Console e testada com contas de cada perfil. A mudança de código nesta PR não publica as regras no projeto Firebase e não libera produção.
