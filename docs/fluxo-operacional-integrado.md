# Fluxo operacional integrado — ANACLETO ESQUADRIAS

## Princípio de arquitetura
Cada informação tem uma origem principal, um responsável e um ciclo de vida. Os módulos podem consultar e referenciar o mesmo registro, mas não devem criar cópias independentes do mesmo dado. A navegação pode reunir funções; as coleções continuam separadas quando representam entidades diferentes.

## Central de Materiais e Inteligência Técnica
- **Biblioteca Técnica:** fonte de verdade para documentos técnicos, perfis, códigos, peso linear, comprimento comercial, regras de corte, acessórios e compatibilidade.
- **Fornecedores e Catálogos:** fonte comercial para fornecedores, SKUs, fotos, catálogos, unidades de venda e referências externas.
- **Preços e Cotações:** histórico de ofertas por fornecedor, material, unidade, data e validade. Cada cotação é um registro próprio; não sobrescreve a ficha técnica nem outra cotação.
- **Inteligência Integrada:** relaciona material técnico e SKU comercial somente por código e compatibilidade verificados. Sem equivalência aprovada, não há substituição automática.

## Fluxo ponta a ponta
1. **CRM / Comercial:** cadastrar cliente e oportunidade; a oportunidade é a origem do orçamento.
2. **Medição / Projetos / CAD:** registrar medidas, ambiente, tipologia, desenho e revisão. Medidas não confirmadas devem permanecer identificadas como estimadas.
3. **Central de Materiais:** selecionar fabricante, linha, acabamento e tipologia; carregar somente especificações e regras aprovadas.
4. **Orçamento:** gerar lista de materiais (BOM), cortes, quantidades, acessórios, vidro, serviços e mão de obra. O orçamento deve exibir itens faltantes e bloquear recomendação final quando a BOM estiver incompleta.
5. **Pesquisa e Compras:** pesquisar ofertas; manter candidatos pendentes; aprovar manualmente preço, unidade, validade, disponibilidade e frete; comparar cestas completas e compatíveis.
6. **Aprovação do cliente:** congelar a revisão aceita do orçamento e registrar condições comerciais. Alterações posteriores geram nova revisão, sem sobrescrever a aprovada.
7. **Financeiro:** a aprovação comercial pode originar contas a receber e sinal conforme as condições aceitas; compras aprovadas originam contas a pagar. Não duplicar lançamentos ao reabrir uma tela.
8. **Estoque / Recebimento:** registrar entrada a partir de compra/documento, conferir quantidades e rastrear fornecedor e lote quando aplicável. Reserva e baixa devem referenciar a ordem de produção.
9. **Produção / Corte:** criar ordem de produção a partir da revisão aceita; consumir BOM aprovada, desenho e plano de corte. Não recalcular silenciosamente uma ordem já liberada.
10. **Entrega / Instalação:** concluir checklist, evidências e aceite do cliente vinculados à ordem.
11. **Qualidade / Pós-venda:** registrar inspeções, não conformidades, garantia e ações corretivas vinculadas ao projeto/ordem/cliente.
12. **Relatórios:** consolidar dados de origem sem se tornar uma segunda fonte de cadastro.

## Estados e gates
- **Rascunho:** ainda editável, não compromete compras ou produção.
- **Pendente de revisão:** importação, extração por IA ou pesquisa externa; não pode alimentar cálculo automático.
- **Verificado / aprovado:** validado por pessoa autorizada e com fonte rastreável.
- **Incompleto / bloqueado:** falta medida, regra, acessório, compatibilidade, preço ou frete exigido.
- **Aprovado pelo cliente:** revisão comercial congelada para execução.
- **Em execução / concluído:** estados operacionais da compra, produção, entrega e pós-venda.

## Regras contra duplicidade
- Cliente: registro mestre em CRM; orçamentos e ordens guardam apenas a referência do cliente.
- Material técnico: registro mestre na Biblioteca Técnica; SKU e preço ficam em registros comerciais relacionados.
- Fornecedor: cadastro mestre único; catálogos, cotações e compras apontam para seu identificador.
- Orçamento: uma entidade com revisões; PDF, desenho e BOM referenciam a revisão, não criam outro orçamento.
- Compra: uma entidade com itens e parcelas; financeiro referencia a compra e não replica seus itens como nova compra.
- Estoque: movimentos imutáveis ligados a recebimento, reserva, consumo ou ajuste autorizado.
- Documentos: manter URL/arquivo, origem, versão, data e estado de revisão; evitar reimportação silenciosa.

## Critérios de aceitação
- Nenhum módulo cria um segundo cadastro mestre para entidade já existente.
- Toda transição registra autor, data, origem e identificador relacionado.
- Uma operação repetida não duplica lançamentos, compras, reservas ou movimentos (idempotência).
- Nenhuma informação pendente entra em cálculo, recomendação de compra ou liberação de produção.
- A trilha de auditoria permite reconstruir orçamento, compra, recebimento, produção e entrega.
- O proprietário exclusivo `safeness.c.a@gmail.com` mantém seus privilégios; esta reorganização não altera regras de autorização.
