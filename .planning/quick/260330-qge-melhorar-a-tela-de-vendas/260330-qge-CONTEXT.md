# Quick Task 260330-qge: Melhorar a tela de vendas - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Task Boundary

Melhorar a tela de vendas (/orders) com métricas, filtros avançados, UX da tabela e mapeamento correto de status ML.

</domain>

<decisions>
## Implementation Decisions

### Métricas e Resumo
- Cards no topo com: total de vendas, faturamento total, lucro líquido
- Métricas devem reagir aos filtros ativos (conta, período, status)

### Filtros Melhorados
- **Data personalizada**: Manter atalhos rápidos (7d, 30d, 90d) + opção "Personalizado" que abre date range picker (de/até)
- **Seleção múltipla de produtos**: Permitir filtrar por múltiplos produtos
- **Status de venda**: Pesquisar e mapear todos os status reais da API ML, criar filtro com estados possíveis + melhorar badges visuais

### UX da Tabela
- **Paginação real**: Implementar paginação no frontend com controles
- **Ordenação por coluna**: Clicar no header para ordenar ASC/DESC
- **Busca**: Campo de busca por produto/comprador
- **Agrupamento opcional**: Por dia, por produto, por conta — como opção do usuário
- **Salvar filtros e agrupamento**: Persistir configuração do usuário (localStorage ou DB)

### Claude's Discretion
- Escolha de componente de date picker (react-day-picker ou similar do shadcn)
- Layout exato dos cards de métricas
- Implementação técnica do agrupamento (client-side vs server-side)
- Formato de persistência dos filtros salvos

</decisions>

<specifics>
## Specific Ideas

- Status de venda do ML incluem estados como "pending" que aparecem frequentemente — precisa mapear corretamente
- Agrupamento é opcional, não obrigatório — UX deve ser limpa sem agrupamento ativo
- Filtros salvos devem persistir entre sessões

</specifics>

<canonical_refs>
## Canonical References

- API ML Orders: GET /orders/search?seller={user_id} — verificar campos `status`, `order_status` para mapeamento completo
- CLAUDE.md contém referência rápida da API ML

</canonical_refs>
