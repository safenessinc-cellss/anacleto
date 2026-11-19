# Plano de execução — etapas 1 a 6

Branch: `feature/catalogo-tecnico-integrado`

## 1. Auditar e unificar os cadastros existentes
**Estado: auditoria de código concluída; inventário do Firestore pendente.**

- [x] Mapear `catalog`, `supplier_catalog`, `registry_items`, `price_table`, `tipologias`, `technical_drawings`, `material_lists`, `cut_plans`, `profile_optimization` e `quotes`.
- [x] Identificar divergências de unidade, preço/kg local, tipologia genérica e importação PDF heurística.
- [x] Definir migração aditiva, preservando IDs e documentos antigos.
- [ ] Ler/exportar dados reais do Firestore e produzir relatório de duplicidades.
- [ ] Confirmar matriz de permissões antes de alterar regras.

## 2. Criar biblioteca técnica normalizada
**Estado: fundação de dados criada; integração Firestore/UI pendente.**

- [x] Definir fornecedor, item técnico canônico, linha de esquadria e oferta de fornecedor.
- [x] Separar SKU original do fornecedor e código canônico ANACLETO.
- [x] Definir unidades de preço: kg, m, m², unidade, barra e conjunto.
- [x] Criar importador de legado que produz candidatos em revisão, sem aprovar preço ou compatibilidade automaticamente.
- [ ] Criar telas de revisão, normalização e associação de fornecedores.
- [ ] Importar catálogos reais após validar os arquivos e as permissões.

## 3. Definir e validar fórmulas de fabricação
**Estado: motor de expressões e BOM versionada criados; fórmulas reais pendentes.**

- [x] Criar avaliador seguro de fórmulas (AST, sem `eval`).
- [x] Exigir tipologia aprovada, fonte técnica, responsável e evidência de validação antes de gerar BOM de fabricação.
- [x] Exigir dados dimensionais para perfis e vidros.
- [ ] Inserir medidas, folgas, cortes e componentes da janela Suprema de duas folhas a partir de documentação oficial.
- [ ] Validar a primeira tipologia com uma fabricação real.
- [ ] Repetir a validação para Gold e demais modelos.

**Bloqueio explícito:** não preencher fórmulas com medidas presumidas. É necessária tabela técnica do fabricante/sistemista ou ficha de fabricação validada pela serralheria.

## 4. Integrar fornecedores brasileiros
**Estado: modelo de ofertas definido; importação e revisão pendentes.**

- [ ] Cadastrar distribuidores/fabricantes e suas fontes.
- [ ] Importar perfis, ferragens, acessórios, parafusos, vedação e vidros.
- [ ] Guardar preço, unidade, acabamento, validade, origem e data de verificação.
- [ ] Implementar comparação de fornecedores e substitutos somente quando compatibilidade estiver confirmada.
- [ ] Implementar atualização de preço sem alterar orçamento aprovado.

## 5. Integrar orçamento, compras e produção
**Estado: arquitetura e funções de domínio criadas; integração com telas/Firestore pendente.**

- [x] Definir cálculo de alumínio por kg/m, vidro por m² e componentes por unidade/conjunto.
- [x] Diferenciar markup de margem bruta.
- [x] Bloquear orçamento como custo completo quando houver componente sem preço ou incompatível.
- [x] Definir snapshot técnico-comercial imutável.
- [ ] Conectar o motor ao formulário de orçamento.
- [ ] Gerar lista de compra e ordem de fabricação a partir da BOM.
- [ ] Integrar plano de corte e aproveitamento de barras depois da validação das fórmulas.

## 6. Testar, revisar e publicar
**Estado: não iniciado.**

- [ ] Executar lint/typecheck e build.
- [ ] Testar cálculos unitários e casos de erro.
- [ ] Comparar a janela piloto com lista de corte e compra reais.
- [ ] Revisar regras do Firestore e migração.
- [ ] Abrir PR para revisão.
- [ ] Fazer merge e publicar em Vercel somente após aprovação dos testes.
- [ ] Verificar o deploy e os fluxos reais depois da publicação.

## Commits iniciais desta branch

- `src/utils/technicalCatalog.ts` — contrato de dados e cálculo comercial/técnico.
- `src/utils/manufacturingFormulas.ts` — fórmulas paramétricas e BOM versionada.
- `src/utils/legacyCatalogMigration.ts` — normalização segura de dados legados para revisão.
- `docs/auditoria-catalogos-existentes.md` — auditoria do estado atual.
- `docs/catalogo-tecnico-integrado.md` — arquitetura e migração.
- `docs/plano-execucao-1-a-6.md` — este acompanhamento.

## Regra de liberação

Nenhuma tipologia será habilitada para fabricação enquanto a sua fórmula, componentes, compatibilidades, espessuras, folgas e cortes não tiverem sido validados. Nenhum preço não verificado será apresentado como preço atual. Nenhum documento legado será apagado durante a migração.
