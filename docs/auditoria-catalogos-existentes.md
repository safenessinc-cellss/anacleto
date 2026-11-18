# Etapa 1 — Auditoria dos cadastros e catálogo técnico

Branch de trabalho: `feature/catalogo-tecnico-integrado`

## Resultado da auditoria inicial do código

A aplicação já possui vários cadastros úteis, mas hoje eles representam fontes paralelas de dados. Não se deve apagar nem fundir documentos automaticamente: há registros históricos e orçamentos que dependem dos identificadores atuais.

### Coleções e componentes encontrados

| Área atual | Coleção / arquivo | O que faz hoje | Problema para a nova lógica |
| --- | --- | --- | --- |
| Catálogo comercial | `catalog` / `src/components/catalog/CatalogModule.tsx` | Produtos gerais com SKU, unidade, preço e anexos | Não separa item técnico canônico de oferta/preço por fornecedor |
| Catálogo de fornecedor | `supplier_catalog` / `src/components/supplier-catalog/SupplierSuperCatalog.tsx` | Produto, fornecedor, código, categoria, unidade, preço, comprimento; importação CSV/PDF | Não exige unidade-base coerente, validade, origem verificável, kg/m, espessura ou estado de revisão |
| Cadastro de itens | `registry_items` / `src/components/registry/RegistryModule.tsx` | Itens genéricos, SKU, preço, anexos | Sobrepõe parte de `catalog` e `supplier_catalog` |
| Tabela de preços | `price_table` | Nome, código, preço, categoria, unidade, fornecedor | Quarta fonte consultada diretamente pelo orçamento |
| Tipologias | `tipologias` / `BusinessWorkspace.tsx` | Registro genérico de nome, código, categoria, dimensões, quantidade e preço | Não tem versão de fórmula, linha de sistema, BOM nem validação de componentes |
| Desenho técnico | `technical_drawings` / `TechnicalDrawingModule.tsx` | Desenho paramétrico, especificação, peças e orçamento preliminar | A especificação visual/paramétrica não equivale a fórmula de fabricação aprovada |
| Lista de materiais | `material_lists` / `RegistryModule.tsx` | Registros de listas associados a orçamento/produção | Ainda não é gerada por uma BOM técnica validada |
| Plano de corte | `cut_plans` | Registros de planos | Não deve ser tratado como otimizador validado só por existir o cadastro |
| Aproveitamento | `profile_optimization` | Registros de análises de barras/sobras | A tela atual alerta que não substitui otimização técnica validada |
| Orçamentos | `quotes` / `QuotesModule.tsx` | Escuta as quatro fontes comerciais e cria itens de orçamento | Pode exibir fontes sobrepostas e não tem resolução técnica única |

## Problemas técnicos identificados

1. **Preço do alumínio local ao navegador:** `src/utils/catalogPricing.ts` guarda `anacleto.aluminum-price-per-kg` no `localStorage`. Isso não é centralizado por empresa, fornecedor, acabamento ou vigência e pode divergir entre dispositivos.
2. **Estimativa por texto:** `aluminumWeightPerMeter` tenta extrair kg/m da descrição/nome. Dado técnico não deve depender de regex em texto livre; precisa de campo numérico validado.
3. **Preço sem unidade inequívoca:** `estimatedCatalogPrice` retorna `item.price` sem saber se representa kg, metro, barra, unidade ou m². Isso pode produzir valores incorretos.
4. **Tipologia sem BOM:** `tipologias` é um formulário genérico, não uma receita versionada de fabricação.
5. **Compatibilidade ausente:** categorias genéricas não provam que uma fechadura, roldana, perfil ou vidro é compatível com uma linha/modelo.
6. **Importação PDF heurística:** o extrator de PDF sugere descrição e preço por linha; os dados devem permanecer como rascunho até revisão humana.
7. **Desenho não é autorização de fabricação:** `localParametricSpec` consegue inferir tipologia e dimensões a partir de texto, mas não conhece sozinho folgas, cortes, encaixes ou ferragens oficiais.
8. **Orçamento consulta múltiplas coleções:** `QuotesModule` combina `catalog`, `supplier_catalog`, `registry_items` e `price_table` diretamente. A integração deve migrar para um serviço de resolução e manter leitura legada durante a transição.
9. **Regras atuais do Firestore:** as coleções de operação usam `canOperate` e `canManageCommercial`; a coleção nova não deve ser adicionada às regras sem decidir quem pode ler, importar, revisar preços, aprovar dados técnicos e editar fórmulas.

## Modelo-alvo aprovado para a migração

- `technical_catalog_items`: identidade técnica canônica do componente, código canônico, categoria, unidade-base e atributos físicos.
- `suppliers`: cadastro normalizado de fornecedores.
- `supplier_offers`: SKU original, preço, unidade de preço, acabamento, validade, origem e estado de verificação.
- `system_lines`: Suprema, Gold e outras linhas, com fabricante e relações explicitamente validadas.
- `tipologia_definitions`: modelos paramétricos com dimensões, linha e versão da fórmula.
- `manufacturing_boms`: lista de materiais por tipologia/versão, com regra de quantidade, cortes, folgas e compatibilidade.
- `quote_manufacturing_snapshots`: cópia imutável do cálculo e dos preços usados em orçamento aprovado.

A primeira versão do contrato de dados e das funções puras está em `src/utils/technicalCatalog.ts`.

## Política de migração sem perda

1. Manter as coleções antigas como fontes legadas durante a migração.
2. Não apagar nem renomear documentos existentes.
3. Criar um mapa explícito `legacyCollection + legacyId -> canonicalItemId`.
4. Importar dados como `pending_review` por padrão; não promover preços extraídos automaticamente a preços verificados.
5. Nunca inferir compatibilidade a partir apenas de nome/categoria.
6. Manter os IDs antigos nos itens de orçamentos já gravados.
7. Migrar uma tipologia de cada vez e comparar com ordem de fabricação real.
8. Só ativar a nova resolução no orçamento depois de testes aprovados.

## Critério de conclusão da etapa 1

- [x] Identificar fontes de dados e telas existentes.
- [x] Documentar duplicidades e problemas de unidade/preço.
- [x] Definir modelo canônico e coleções-alvo.
- [x] Definir migração aditiva e sem exclusão.
- [ ] Exportar/contabilizar os documentos reais do Firestore. Isso exige leitura autenticada do banco; não é possível inferir contagens ou conteúdo de produção apenas pelo código.
- [ ] Validar matriz de permissões com o proprietário antes de alterar regras.
