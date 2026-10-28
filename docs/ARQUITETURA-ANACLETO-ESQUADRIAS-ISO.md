# Arquitetura — ANACLETO ESQUADRIAS + ISO

## Objetivo
Aplicação web responsiva para orçamento e produção de esquadrias de alumínio/vidro, com visualização CAD e gestão de qualidade alinhada à ISO 9001. A interface do cliente deve ser simples; fórmulas e listas de corte são internas.

## Arquitetura lógica
- **Frontend:** React + TypeScript + Vite; componentes por domínio, navegação responsiva, idioma PT-BR / ES / EN.
- **Identidade e acesso:** Firebase Authentication; perfis e permissões (Administrador, Comercial, Engenharia/Produção, Qualidade ISO, Cliente).
- **Persistência:** Cloud Firestore com isolamento por empresa (tenantId), regras de segurança por função e validação no servidor.
- **Arquivos:** PDFs de orçamento, desenhos e documentos controlados em armazenamento privado; links temporários quando partilhados.
- **Hosting:** Vercel, com previews por branch e deploy de produção a partir da branch principal.
- **Integrações futuras:** WhatsApp Business Platform, serviço de e-mail transacional, geração de PDF e notificações. Segredos exclusivamente em variáveis de ambiente server-side.

## Módulos
1. **Dashboard:** indicadores, atividade recente e alertas.
2. **Clientes:** cadastro, contactos e histórico.
3. **Orçamentos:** rascunho, revisão, enviado, aprovado, rejeitado, expirado; numeração e validade; PDF comercial simplificado.
4. **Desenho CAD:** vistas 3D/frontal/lateral/superior; dimensões gerais; atualização do desenho com alterações do produto. O modelo 3D deve usar geometria parametrizada e não uma imagem fixa.
5. **Catálogo técnico:** sistemas de perfis, barras comerciais, vidros, ferragens, acabamentos e regras de montagem.
6. **Cálculo e corte:** regras versionadas por sistema de perfil; descontos/folgas, ângulos, largura de serra, barras de origem e otimização de cortes. Nenhum corte definitivo deve ser calculado com fórmulas não verificadas.
7. **Produção:** ordem criada após aprovação, lista de peças, etiquetas, plano de corte e estados de fabricação.
8. **Envio:** ações de WhatsApp e e-mail a partir do orçamento; registo de destinatário, horário, estado e falhas. O PDF enviado ao cliente contém apenas desenho simples, dimensões gerais, descrição, preço e condições.
9. **ISO 9001:** documentos controlados, revisões, auditorias, não conformidades, ações corretivas, evidências, responsáveis e indicadores.
10. **Administração:** utilizadores, empresas, contactos comerciais, idioma, impostos e preferências.

## Fluxo de orçamento e produção
1. Comercial cria um orçamento em estado **Em elaboração**.
2. Seleciona tipo (janela, porta, box de banheiro ou outro), sistema de perfis, dimensões, abertura, vidro e acabamento.
3. O desenho paramétrico atualiza-se e o motor calcula custos com as regras cadastradas.
4. O PDF comercial é gerado com desenho simples e sem dados internos de fabrico.
5. Comercial envia por WhatsApp e/ou e-mail; sistema regista o estado de entrega.
6. Quando o orçamento é aprovado, cria-se uma ordem de produção e congela-se uma cópia versionada dos parâmetros aprovados.
7. O motor de corte gera peças e comprimentos a partir das fórmulas verificadas do sistema selecionado; utilizador técnico valida o plano antes da libertação para fabrico.
8. Alterações posteriores exigem nova revisão, preservando a rastreabilidade ISO.

## Modelo de dados (coleções Firestore propostas)
- `companies/{companyId}`
- `companies/{companyId}/users/{userId}`
- `companies/{companyId}/customers/{customerId}`
- `companies/{companyId}/quotes/{quoteId}`
- `companies/{companyId}/quoteVersions/{versionId}`
- `companies/{companyId}/profileSystems/{systemId}`
- `companies/{companyId}/materials/{materialId}`
- `companies/{companyId}/productionOrders/{orderId}`
- `companies/{companyId}/cutPlans/{cutPlanId}`
- `companies/{companyId}/documents/{documentId}`
- `companies/{companyId}/audits/{auditId}`
- `companies/{companyId}/nonconformities/{ncId}`
- `companies/{companyId}/correctiveActions/{actionId}`
- `companies/{companyId}/messageLogs/{messageId}`

## Estados principais
- Orçamento: `draft`, `in_review`, `sent`, `approved`, `rejected`, `expired`, `cancelled`.
- Envio: `queued`, `sent`, `delivered` (quando o fornecedor suportar), `failed`.
- Produção: `pending_validation`, `released`, `in_production`, `completed`, `blocked`.

## Requisitos de segurança e qualidade
- Firestore Security Rules com verificação de empresa e papel; nunca confiar apenas no frontend.
- Segredos de WhatsApp/e-mail e credenciais administrativas somente no backend/variáveis de ambiente.
- Registo de auditoria para mudanças de preço, dimensões, fórmulas, aprovação, envio e documentos ISO.
- Fórmulas de corte versionadas e testadas com casos conhecidos; revisão humana antes de fabricar.
- Backups, retenção e exportação de dados; PDFs de cliente separados dos documentos técnicos internos.
- Testes de permissões, cálculos, estados, geração de PDF e fluxos de aprovação.

## Fases de implementação
1. Validar fundação atual (autenticação, Firestore, regras e deploy).
2. Consolidar o fluxo comercial: orçamento, estados, PDF simples e envio.
3. Implementar catálogo de perfis e motor de cálculo de cortes validado.
4. Implementar desenho 3D paramétrico e vistas técnicas.
5. Completar produção, etiquetas e otimização de barras.
6. Completar módulos ISO, auditorias e ações corretivas.
7. Testes de segurança, aceitação e entrada em produção.

> Nota: este documento define a arquitetura-alvo. A presença de um módulo na arquitetura não significa que já esteja integralmente implementado ou que integrações externas estejam configuradas.
