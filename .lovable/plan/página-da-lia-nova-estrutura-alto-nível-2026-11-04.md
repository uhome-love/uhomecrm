# Página da Lia — nova estrutura (alto nível)

## Problema hoje
- 13 abas numa faixa só (Painel, Trânsito, Leads e conversas, Kanban, Follow-ups, Qualificados, Recupera, Reengajamento, Mensagens, Conhecimento, Laboratório...), cortando na tela.
- Assuntos repetidos: Leads, Kanban, Trânsito e Qualificados mostram os mesmos clientes de jeitos diferentes.
- Filtro de imóvel com nomes técnicos ("curadoria", "flow") e campanhas antigas.
- Números soltos sem contexto (ex.: "0,0% venda" sem explicar), sem status claro de "a Lia está ligada? atendendo o quê?".

## Nova estrutura: 6 áreas no menu lateral da página

```text
+-----------------+---------------------------------------------+
| LIA  ● Teste    |  Cabeçalho: status, período, filtro produto |
|-----------------|---------------------------------------------|
| Visão geral     |  conteúdo da área                           |
| Conversas       |                                             |
| Recuperação     |                                             |
| Relatórios      |                                             |
| Cérebro         |                                             |
| Configurações   |                                             |
+-----------------+---------------------------------------------+
```

1. **Visão geral (painel)** — cartão de status (modo teste/ligada, o que atende: só descartes), 4 números principais com comparação, funil único Contato → Qualificado → Fila CEO → Visita → Venda, "precisa de você agora" (conversas aguardando humano, recuperados na Fila CEO, alertas do Laboratório).
2. **Conversas (atendimento)** — caixa estilo WhatsApp em 3 colunas: lista com filtros rápidos (Em andamento, Aguardando humano, Qualificados, Follow-up, Encerrados) | conversa | ficha do cliente (perfil, temperatura, produto, ações). Absorve Leads e conversas, Kanban (vira alternância Lista/Quadro), Follow-ups, Qualificados e Trânsito.
3. **Recuperação** — fluxo dos descartes: Elegíveis → Em cadência → Responderam → Recuperados (Fila CEO) → Opt-out; controle do piloto (100/dia, ligado/desligado), cadência e templates de mensagem. Absorve Recupera, Reengajamento e Mensagens.
4. **Relatórios** — período padrão (seletor do CRM), desempenho por produto, por motivo de descarte, temperatura, tempo de resposta, conversão até venda, organograma do fluxo (diagrama visual: entrada → Lia → qualificação → Fila CEO → corretor), exportar PDF.
5. **Cérebro (inteligência)** — Conhecimento (fichas e mídias dos produtos), Regras (linhas vermelhas aprendidas), Laboratório (40 cenários, aprovar/ajustar), placar de qualidade.
6. **Configurações** — número da Lia, campanhas ligadas (hoje nenhuma), horários, limites, modelo de IA, histórico de alterações.

## Visual
- Segue o design system já aprovado (tokens shell-*, PageHeader, KpiCard, EmptyState, PeriodSelector, Inter, #4969FF).
- Menu lateral interno no computador; no celular vira seletor no topo.
- Filtro de produto mostra só nomes oficiais dos produtos ativos.
- Endereços antigos (`?aba=...`) continuam funcionando, levando para a área nova.

## Fases (uma de cada vez, validando antes da próxima)
0. **Mockup** das 6 áreas para sua aprovação (nada muda no CRM).
1. Estrutura: menu lateral, cabeçalho de status e redirecionamento das abas antigas.
2. Visão geral.
3. Conversas (caixa unificada).
4. Recuperação.
5. Relatórios + organograma.
6. Cérebro e Configurações.
7. Validação ponta a ponta no computador e celular, sem enviar mensagem a cliente.

## Regras que não mudam
- Lia continua só com descartes, piloto desligado, recuperados vão para Fila CEO e nunca voltam ao corretor que descartou.
- Mudança só de apresentação: mesmos dados e mesmas ações de hoje; nada de envio, distribuição ou contagem alterado.

## Detalhes técnicos
- `LiaHub` vira shell com navegação por `?area=` + mapa de compatibilidade das 13 chaves `?aba=`.
- Componentes atuais em `src/components/lia-hub/` são reaproveitados dentro das áreas; `LiaTransitoTab` (470), `LiaLeadsTab` (428) e `LiaPainelTab` (387) são divididos para ficar abaixo de 300 linhas.
- Uma fonte de dados por lista (hooks atuais), sem consultas novas duplicadas; Relatórios lê os mesmos agregados do Painel.
- Sem migrations nesta etapa.
