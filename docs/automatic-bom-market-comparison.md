# ANACLETO — BOM técnico e comparação de mercado

## Objetivo
Gerar uma lista completa de materiais (BOM) a partir de uma tipologia e de regras técnicas verificadas; pesquisar ofertas online; comparar cestas por fornecedor; recomendar somente alternativas tecnicamente compatíveis.

## Fluxo de dados
1. O orçamento recebe tipologia, fabricante/sistema, largura, altura, quantidade, acabamento, vidro e condições de instalação.
2. O motor consulta `cutting_rules`, `aluminum_profiles` e `hardware_catalog`, usando exclusivamente registros `verified`.
3. As regras produzem itens BOM com código, unidade, quantidade, medidas de corte, barra comercial, acabamento, chave de compatibilidade e referência documental/página.
4. O endpoint `POST /api/supplier/market-research` pesquisa cada item com código/descrição, fabricante, linha, acabamento e região.
5. Ofertas encontradas são candidatas não verificadas. A equipe confirma página, código, acabamento, unidade, disponibilidade, frete, pedido mínimo e validade.
6. Ofertas aprovadas são armazenadas como preços verificados; o comparador calcula a cesta completa por fornecedor e só classifica como completa a cesta que cobre todos os itens obrigatórios.

## Regras de segurança técnica e comercial
- Nunca executar `formula` de Firestore como JavaScript. Fórmulas precisam de parser matemático restrito e variáveis explicitamente permitidas.
- Não gerar BOM final se faltarem regras verificadas para a tipologia/configuração ou se houver perfil sem código, unidade ou comprimento comercial confirmado.
- Não misturar fabricante/sistema, códigos, acabamento ou componentes incompatíveis.
- Não converter preço por barra, metro, peça, kg ou m² sem unidade de venda confirmada.
- Não tratar snippet de busca, preço estimado ou resultado de marketplace como cotação verificada.
- Preços precisam de data de observação e, quando fornecida, validade.
- Frete deve ser aplicado uma vez por cesta, não uma vez por componente.
- A otimização de barras usa first-fit-decreasing e kerf configurável; o plano deve continuar ligado às medidas de corte aprovadas.
- Recomendações exibem menor custo completo, melhor custo-benefício e premium apenas quando houver evidência técnica e comercial suficiente. Caso contrário, exibem "dados insuficientes".

## Implementação desta etapa
- `src/server/technical-bom.ts`: tipos, validação de BOM, otimização de barras e comparação de cestas.
- `api/supplier/market-research.ts`: endpoint autenticado de pesquisa online, limitado por usuário, que devolve fontes e possíveis preços BRL sem aprová-los automaticamente.

## Próximas etapas obrigatórias
1. Ligar o gerador de BOM ao fluxo de criação de orçamento.
2. Criar parser seguro para fórmulas técnicas verificadas e validar contra exemplos de fabricação de cada fabricante/linha.
3. Carregar os registros técnicos validados e as compatibilidades de acessórios.
4. Ligar a pesquisa online ao painel de comparação no orçamento.
5. Criar fluxo de aprovação de preço e persistência de histórico.
6. Testes unitários de corte, compatibilidade, validade de preços, unidades e cestas incompletas.
7. Build/CI, revisão e implantação; publicar regras Firestore/Storage manualmente no Firebase Console quando aplicável.
