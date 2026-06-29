# Polimento incremental — Oferta Ativa

Escopo: melhorias de UX, visual, correção de bugs e pequenas eficiências, priorizando a Arena do corretor. **Sem** reestruturar fluxo, schema, RLS ou edge functions. **Sem** novas features de IA. Tudo em código frontend.

Itens deixados de fora deste ciclo (anotados no fim) são recomendações maiores que exigem decisão à parte.

---

## Fase 1 — Bugs reais (prioridade máxima)

Correções de comportamento incorreto, na ordem de impacto.

1. **Summary de sessão nunca aparece p/ quem já tinha tentativas** (`CorretorCall.tsx:227`): `handleExitArena` compara `progress.tentativas` (contador do dia) em vez das tentativas da sessão atual. Passar a contar tentativas feitas desde a entrada na Arena (snapshot do contador no início da sessão).

2. **Streak falsa (hardcoded `3`)** (`CorretorCall.tsx:204`): hoje mostra "3 dias seguidos" para qualquer um com ≥1 tentativa. Como não vamos criar lógica nova de streak, remover a exibição da streak fake (warmup e prop em `ArenaSessionSummary`) até existir fonte real, evitando dado mentiroso.

3. **Aba "Resultado" no mobile mostra conteúdo errado** (`DialingModeWithScript.tsx:1222-1223`): renderiza `{ToolsColumn}` (script) em vez do painel de resultado. Apontar a aba para o conteúdo correto.

4. **Script editado some ao trocar de lead** (`ScriptPanel.tsx:104-112`): o `useEffect` reseta o texto quando o `lead` muda mesmo após edição manual. Preservar edição manual do corretor (só resetar quando muda empreendimento/template, não a cada lead).

5. **"Retirar do sistema" por string mágica** (`AttemptModal.tsx:81`): exclusão permanente disparada por comparação de string literal no feedback. Trocar por flag/estado explícito (checkbox dedicado), eliminando exclusão acidental se o corretor digitar a frase.

6. **Label de resultado cru no histórico** (`AttemptHistory.tsx:12-16`): falta o mapeamento de `nao_atendeu`, mostrando a chave crua. Completar o dicionário de labels (alinhar com `RecentCallsHistory`).

7. **`repeatRate` sempre 0% no Radar** (`OAObservabilityPanel.tsx:43`): lê `lead_id` de campo inexistente. Ler de `metadata.lead_id` corretamente (ou ocultar a métrica se a fonte não tiver o dado, com rótulo claro).

---

## Fase 2 — Remover código morto / confusão de UX

8. **`DialingMode.tsx` (343 linhas) é código morto**: o fluxo de produção sempre usa `DialingModeWithScript`. Remover o arquivo e imports órfãos (confirmado que não é referenciado na rota ativa).

9. **`SessionCoachingModal` órfão** (`DialingModeWithScript.tsx:1276-1283`): o state que abre o modal nunca é setado — nunca abre. Decisão: **remover** a renderização morta (mantemos o componente no repo caso seja reativado depois, mas sem montá-lo inutilmente). Sem criar IA nova.

10. **Botões duplicados na Arena**:
    - `CorretorCall.tsx:497-502`: "Escolher leads manualmente" faz o mesmo que "COMEÇAR AGORA" → remover o botão enganoso.
    - `CorretorCall.tsx:603-618`: "Pausar" e "Sair" chamam a mesma ação → manter apenas "Sair" (ou tornar "Pausar" funcional como minimizar; neste ciclo, simplificar para um único botão).

11. **`empreendimento` hardcoded no summary** (`CorretorCall.tsx:663`): sempre "Arena de Ligação". Como o resumo é de sessão multi-lista, simplificar o card para não exibir um empreendimento fixo enganoso.

---

## Fase 3 — Fonte única de empreendimentos

12. **4 listas hardcoded e divergentes** de empreendimentos em `ScriptPanel.tsx:13`, `HomiObjectionHelper.tsx:14`, `FichaRapida.tsx:7` (e a 4ª variação). Criar um único módulo `src/lib/empreendimentos.ts` (ou reaproveitar `useRoletaSegmentos`/produtos já existentes) como fonte única e consumir nos três componentes. Sem mudar schema — apenas consolidar a constante já existente em código.

---

## Fase 4 — Estados de carregamento / vazio / erro

13. **`ResultPopup` sem feedback durante submit** (`DialingModeWithScript.tsx`): adicionar spinner/disable no botão "Confirmar e Próximo" enquanto `submitting`.

14. **`OAObservabilityPanel` sem empty/error state**: adicionar mensagem clara quando `oa_events` está vazia e tratamento de erro.

15. **`PerformanceLivePanel` sem error handling**: adicionar estado de erro nas queries (mensagem em vez de painel inconsistente).

16. **`AproveitadosPanel` sem limite**: aplicar limite + "carregar mais" (ou virtualizar) para corretores com muitos aproveitados, evitando travar a aba.

---

## Fase 5 — Mobile / responsividade

17. **Altura fixa cortada em iOS** (`CorretorCall.tsx:526`): `h-[calc(100vh-3.5rem)]` → usar `100dvh`/safe-area para não cortar conteúdo em Safari mobile.

18. **Stats de lista invisíveis no mobile** (`CorretorListSelection` `ListaRow`): `hidden sm:flex` esconde a contagem de fila — exibir versão compacta no mobile.

19. **Rankings sem scroll horizontal** (`RankingPanel.tsx`): garantir `overflow-x-auto` na tabela larga.

20. **`AttemptModal` grid 4 col apertado no mobile**: ajustar para 2 colunas em telas estreitas.

---

## Fase 6 — Pequenas eficiências de query (baixo risco, sem mudar schema)

21. **`useOAListas` refetch excessivo** (`useOfertaAtiva.ts:103`): `staleTime: 0` + `refetchOnWindowFocus` recarrega a cada foco. Ajustar para `staleTime` razoável (ex.: 30–60s).

22. **`CampaignManager` N+1 de stats**: trocar a query por-lista pelo RPC batch já existente (`get_batch_lista_stats`), igual ao `CorretorListSelection`.

23. **`ScriptPanel` carrega dropdown sem necessidade**: tornar as queries de `team_scripts`/`marketplace_items` lazy (só ao abrir "Trocar script").

24. **`TemplateManager`/`RecentCallsHistory` sem `staleTime`**: definir `staleTime` para reduzir refetch em remontagens.

---

## Técnico / Verificação

- Tudo é frontend (`src/`); nenhuma migration, edge function, RLS ou schema é alterado neste ciclo.
- `tsgo` para checagem de tipos; revisão visual da Arena (`/corretor/call`) e da página admin (`/oferta-ativa`) em desktop e mobile via Playwright (screenshots warmup, session, modais, abas mobile).
- Cada fase é independente; posso entregar em ordem e validar no preview.

---

## Fora deste ciclo (recomendações para decisão futura)

Itens de maior risco/estrutura que **não** entram agora (você pediu incremental), mas registro para próxima rodada:

- **RLS**: leads de listas "liberadas" são visíveis (nome/telefone) a qualquer corretor; UPDATE não filtra por lista. Endurecer exige plano de segurança próprio.
- **Índice em `oferta_ativa_leads.proxima_tentativa_apos`** e revisão do `cleanup_expired_locks` rodando inline em cada `fetch_next_lead` (mover para cron) — ganho de performance, mas é mudança de banco.
- **Dedup de `useOAServerQueue`/`useOACampaignQueue`** (~80 linhas duplicadas) em um hook único — refactor estrutural.
- **Scoring inteligente de fila** (usar `data_lead`, origem, horário de atendimento) — exige mudar `fetch_next_lead` e alinhar com a diretriz de IA.
- **Locks ausentes em custom lists** (dois corretores podem trabalhar o mesmo lead de pipeline) — decisão de produto.
