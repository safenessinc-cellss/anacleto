# ANACLETO — BOM técnico automático e inteligência de compras

## Objetivo
Gerar a lista de materiais (BOM) a partir de fabricante, linha, tipologia, configuração, dimensões, quantidade e acabamento; pesquisar ofertas online; registrar cotações para revisão; comparar cestas completas por fornecedor.

## Fluxo implementado
1. `GET /api/supplier/technical-options` devolve apenas combinações de fabricante/linha/tipologia/configuração com regras e perfis marcados como `verified`.
2. `POST /api/supplier/generate-bom` lê `cutting_rules`, `aluminum_profiles` e `hardware_catalog` no Firestore e gera o BOM usando apenas registros verificados.
3. As fórmulas são avaliadas por parser aritmético restrito, sem `eval`, `Function` ou execução de JavaScript.
4. Fórmula de perfil representa o comprimento de cada corte em milímetros. `quantityFormula` ou `cutCount` define quantos cortes daquele código existem por esquadria. Variáveis: `W`/`L` = largura em mm, `H` = altura em mm, `Q` = 1 por unidade; a quantidade total de esquadrias é multiplicada separadamente.
5. Cortes do mesmo código/fabricante/linha/acabamento são agrupados e otimizados em barras comerciais, com kerf configurável.
6. Regras não perfil podem gerar vidro, vedações e consumíveis usando `category`, `profileCode` como código do componente, `formula`, `quantityFormula` e `unit`.
7. `hardware_catalog` exige compatibilidade explícita de fabricante, linha e tipologia (ou `Todas` / `*`) e quantidade fixa ou fórmula de consumo. Ausência de acessórios compatíveis torna o BOM incompleto.
8. `POST /api/supplier/market-research` pesquisa cada componente e devolve links e possíveis preços BRL como candidatos não verificados.
9. O operador confirma fornecedor, unidade e preço observado na página e registra a cotação em `supplier_prices` com status `pending_review`.
10. A Biblioteca Técnica permite aprovar/rejeitar a cotação. Somente `status=verified` e `priceStatus=verified` são elegíveis.
11. `POST /api/supplier/compare-bom` compara cestas por fornecedor, exige correspondência exata de código, linha, acabamento e unidade compatível, filtra cotações dos últimos 30 dias e validade, soma frete uma vez por cesta e recomenda a cesta completa de menor custo.
12. Preços por metro ou kg podem ser convertidos em preço por barra somente quando comprimento comercial e peso linear verificados estiverem disponíveis no cadastro do perfil.

## Campos técnicos a cadastrar
### Perfis
- fabricante, linha, código, descrição, acabamento;
- peso linear kg/m;
- comprimento comercial mm;
- documento e página de origem;
- status `verified` somente após conferência no catálogo original.

### Regras de corte
- fabricante, linha, tipologia, configuração, código do perfil/componente;
- fórmula de corte em mm (ex.: `(W - 40) / 2`);
- quantidade de cortes por esquadria em `quantityFormula` ou `cutCount`;
- kerf em mm e unidade;
- documento e página de origem;
- status verificado após validação com desenho/ficha do fabricante.

### Acessórios
- fabricante, linha, tipologia ou `Todas`;
- código, descrição, acabamento e unidade;
- quantidade fixa ou fórmula de consumo por esquadria;
- documento e página de origem;
- status verificado após conferir compatibilidade física.

### Preços
- fornecedor, linha, código, acabamento e unidade de venda;
- preço unitário BRL, data, validade, frete e fonte;
- cotação online começa pendente e só entra na comparação após revisão.

## Limites e controles
- O gerador não presume uma janela Linha 25 padrão nem inventa perfis/acessórios: sem regras verificadas, retorna pendências e não libera recomendação.
- Fórmulas aceitam apenas números, variáveis W/L/H/Q, parênteses e operadores + - * /. Use ponto decimal.
- O cálculo de barras usa first-fit-decreasing; não altera comprimentos de corte.
- Conversão kg/barra usa peso linear kg/m × comprimento comercial em metros. Conversão metro/barra usa comprimento comercial em metros.
- Cotações de busca não são preços confirmados; precisam de conferência manual e aprovação.
- A comparação usa apenas preços aprovados, recentes (30 dias), com validade vigente, e não compara itens tecnicamente incompatíveis.
- Frete armazenado por cotação é tratado como custo de frete da cesta, sem multiplicação por item.
- O BOM é completo em relação aos registros técnicos verificados existentes; a qualidade da cobertura depende da manutenção dos catálogos e das regras.
- Os endpoints exigem autenticação Firebase. O proprietário exclusivo `safeness.c.a@gmail.com` permanece preservado.

## Arquivos
- `src/server/technical-bom.ts`: tipos, validação, otimização e comparação.
- `src/server/cut-formula.ts`: parser matemático seguro.
- `api/supplier/technical-options.ts`: opções de sistemas verificados.
- `api/supplier/generate-bom.ts`: geração de BOM.
- `api/supplier/market-research.ts`: pesquisa online.
- `api/supplier/compare-bom.ts`: comparação de cestas aprovadas.
- `src/components/technical-library/TechnicalLibraryModule.tsx`: campos técnicos e aprovação de cotações.
- `src/components/BudgetModal.tsx`: geração, pesquisa, registro de cotações e comparação no orçamento.

## Validação e implantação
- Executar `npm test`, `npm run lint` e `npm run build`.
- Validar uma esquadria real por fabricante/linha com desenho oficial e medidas de corte aprovadas.
- Regras Firestore existentes cobrem leitura/criação/revisão de `supplier_prices`; não foram alteradas nesta PR.
- Publicação em produção exige merge autorizado e build/deploy Vercel READY.
