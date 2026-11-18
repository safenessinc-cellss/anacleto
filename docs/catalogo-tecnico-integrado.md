# ANACLETO — catálogo técnico integrado

## Objetivo

Unificar os catálogos existentes sem apagar nem duplicar os dados atuais. O orçamento deve consumir uma lista técnica de fabricação (BOM) vinculada a uma linha e a uma tipologia, e cada linha da BOM deve resolver um item compatível e uma oferta de fornecedor vigente.

## O que já existe no projeto

| Recurso atual | Uso atual | Destino na arquitetura |
| --- | --- | --- |
| `catalog` | Produtos gerais e anexos | Catálogo comercial legado; migrar/relacionar com item técnico canônico |
| `supplier_catalog` | Itens importados de PDF/CSV e cadastro manual | Ofertas de fornecedores vinculadas a itens técnicos canônicos |
| `registry_items` | Itens de cadastro | Manter como cadastro operacional legado; evitar nova fonte de preço |
| `tipologias` | Registros genéricos | Evoluir para tipologias paramétricas com BOM versionada |
| `technical_drawings` | Desenhos, peças e orçamento preliminar | Consumir resultado técnico validado e registrar snapshot |
| `material_lists` | Listas manuais de materiais | Gerar a partir da BOM calculada |
| `cut_plans` / `profile_optimization` | Registros de planos/análises | Integrar depois da validação das fórmulas de corte |
| `quotes` | Orçamentos comerciais | Salvar custo, preço, fornecedor, fórmula e snapshot imutáveis na aprovação |

## Regras de domínio

1. **Item técnico canônico** é distinto da oferta do fornecedor. O mesmo perfil pode ter ofertas de mais de um fornecedor, cada uma com SKU, preço, validade, acabamento e fonte próprios.
2. Perfil de alumínio exige peso técnico em kg/m. A oferta pode ser precificada por kg ou metro; a conversão exige comprimento de corte.
3. Vidro exige tipo, espessura e dimensões de cada painel. A oferta por m² calcula área por painel × quantidade, com perda configurável.
4. Ferragens, acessórios, parafusos, fechaduras, roldanas, felpas, borrachas e consumíveis são linhas próprias da BOM, com quantidade e unidade explícitas.
5. Compatibilidade com linha, tipologia, acabamento e espessura deve ser explícita. Ausência de confirmação significa pendência, nunca compatibilidade presumida.
6. Só ofertas verificadas e dentro da validade podem entrar automaticamente no cálculo. Ofertas pendentes ou expiradas permanecem consultáveis, mas não são usadas como preço atual.
7. O cálculo deve retornar pendências por componente. Um orçamento não pode ser apresentado como custo completo quando houver item sem preço ou incompatível.
8. Markup e margem bruta são modos distintos e devem ser identificados no orçamento.
9. Na aprovação, congelar dimensões, BOM, códigos dos fornecedores, preços, validade, perdas, fórmula e versão do motor. Atualizações posteriores não alteram orçamentos aprovados.

## Fontes de fornecedores pesquisadas em 18/11/2026

### Aluíta Alumínio (RS)
- Site institucional e contato: https://www.aluita.com.br/
- Catálogo público de perfis: https://www.catalogoaluita.com.br/perfil
- A listagem pública informa 1.172 perfis em 79 páginas; os preços aparecem como **sob consulta**.
- O e-commerce da Aluíta declara estar em implantação e informa que os itens exibidos são testes; portanto, não tratar os valores/listagens dessa loja como oferta disponível nem gerar pedido automaticamente.
- A empresa também mantém uma seção de acessórios no catálogo online. Cada SKU precisa ser relacionado à linha e tipologia antes de compor uma BOM.

### Esquadrimax Alumínio
- Catálogo de Construção Civil, edição setembro de 2026: https://fliphtml5.com/sacgm/mnnz/
- O catálogo inclui códigos, dimensões e pesos kg/m para perfis, além de linhas de esquadrias, box e acessórios.
- O catálogo consultado não publica preços comerciais gerais; registrar ofertas como **cotação necessária**, nunca com valor estimado.
- A compatibilidade de ferragens e perfis deve ser validada por linha e tipologia, sem misturar sistemas por semelhança visual.

### Política de preço
- Preço público ausente = oferta pendente de cotação, não R$ 0,00 e não preço estimado.
- Guardar fonte, SKU, unidade comercial, comprimento da barra, acabamento, filial/região, data da consulta e validade.
- Preços varejistas publicados por terceiros continuam como referência comercial e não entram no cálculo automático até confirmação de estoque, unidade, impostos e compatibilidade.
- A importação inicial destas fontes é apenas referência documental na interface; ainda exige ingestão/revisão de SKUs no Firestore para uso no motor de orçamento.

## Implementação inicial

`src/utils/technicalCatalog.ts` contém o schema v1 e funções puras para:
- validar dados técnicos;
- verificar compatibilidade;
- selecionar ofertas verificadas e vigentes;
- calcular perfis por kg/m, vidro por m² e componentes por unidade/conjunto;
- calcular preço de venda por markup ou margem bruta;
- criar snapshot técnico-comercial.

O módulo é uma fundação de domínio. Ainda precisa ser ligado às telas, ao Firestore e aos fluxos de orçamento antes de ser usado em produção.

## Sequência segura de integração

1. Auditar e exportar os dados atuais de `catalog`, `supplier_catalog`, `registry_items` e `tipologias`.
2. Criar/normalizar fornecedores e itens canônicos sem apagar os registros legados.
3. Importar catálogos PDF/CSV como rascunhos; revisão humana obrigatória para código, unidade, peso, espessura, acabamento e preço.
4. Criar linhas e tipologias com BOM versionada e fórmulas fornecidas/validadas pelo fabricante ou serralheiro responsável.
5. Integrar a BOM ao orçamento e gerar a lista de compra/produção.
6. Comparar resultados com fabricação real antes de liberar cada tipologia.
7. Migrar os fluxos antigos gradualmente; manter leitura compatível com registros anteriores.

## Segurança e implantação

- Não alterar regras do Firestore até fechar a matriz de permissões das novas coleções.
- Não inserir preços presumidos nem fazer scraping de páginas que proíbam automação.
- Não publicar o branch diretamente em produção. Primeiro executar typecheck/build, revisar migração e testar cálculos com dados reais.
