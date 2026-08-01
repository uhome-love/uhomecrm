# Oferta Ativa — entrada rápida do corretor (estilo Mutirão ao vivo)

Objetivo: o corretor entra e começa a ligar em segundos. Um onboarding curto mostra meta do dia, a campanha disponível e o script — e o botão "Começar a ligar" leva direto ao discador.

## O que existe hoje

- Menu lateral do corretor já tem "Oferta ativa" apontando para `/corretor/call`, e o dashboard já tem um card "Oferta Ativa → Ligar agora" em "O que fazer agora".
- `/corretor/call` abre `CorretorListSelection`: lista agrupada por segmento → produto, com busca, colapsos, listas personalizadas e toggle de esgotadas. Foi desenhada para dezenas de listas fixas — hoje, com campanhas temporárias criadas pelo CEO, normalmente há 1 ou poucas listas liberadas.
- O script já existe dentro do discador (`ScriptPanel` em `DialingModeWithScript`), mas só aparece depois de escolher a lista.
- A campanha já carrega `observacao` (objetivo) e `escopo` (equipe/corretor), então dá para mostrar isso na entrada.

## O que muda

### 1. Tela de entrada nova (substitui a lista longa quando há poucas campanhas)

Ao abrir `/corretor/call`, em vez do catálogo, uma tela objetiva estilo Mutirão:

```text
┌──────────────────────────────────────────────┐
│ ● OFERTA ATIVA          meta do dia: 12/30    │
├──────────────────────────────────────────────┤
│  Campanha do momento                          │
│  The Arch — Investidores                      │
│  🎯 Objetivo: agendar visita no plantão sáb   │
│  128 na fila · 6 aproveitados · expira em 3d  │
│                                               │
│  [ ▶ Começar a ligar ]   [ ver script ]       │
├──────────────────────────────────────────────┤
│  Outras campanhas (2)              ⌄          │
└──────────────────────────────────────────────┘
```

- Se houver **1 campanha liberada**: entra direto nela como destaque, um clique para ligar.
- Se houver **2+**: cards lado a lado, ordenados por leads na fila; sem árvore de segmentos.
- O catálogo antigo (segmentos, personalizadas, esgotadas) vira um link discreto "Ver todas as listas", preservando tudo que já existe.

### 2. Onboarding rápido (1 tela, primeira entrada do dia)

Modal curto no mesmo espírito do Mutirão ao vivo, com 3 blocos e um botão:

1. **Meta do dia** — ligações/aproveitados de hoje vs. meta, com barra de progresso.
2. **Campanha disponível** — nome, objetivo do CEO, quantos leads na fila, prazo.
3. **Script da ligação** — abertura do roteiro da campanha, editável/copiável; botão "usar meu script".

Rodapé: **Começar a ligar** (entra direto no discador) e "pular". Marcado como visto por dia (localStorage por `sessão/dia + campanha`), então não incomoda em reentradas.

### 3. Barra de progresso durante a operação

No topo do discador, faixa fina com meta do dia + contadores da sessão (tentativas, aproveitados, visitas), igual à sensação de placar do Mutirão.

## Detalhes técnicos

- Novo `src/components/oferta-ativa/CorretorEntrada.tsx`: consome `useOAListas` + o filtro de escopo/expiração já existente em `CorretorListSelection` (extraído para `useCampanhasDisponiveis.ts` para não duplicar regra) e `get_batch_lista_stats` para fila/aproveitados.
- Novo `src/components/oferta-ativa/OnboardingOfertaAtivaModal.tsx`, espelhando o padrão de `oferta-ativa-ao-vivo/OnboardingModal.tsx`.
- Meta do dia: reaproveita `corretor_daily_goals` via `useCorretorDailyStats` (sem migração; se não houver meta definida, mostra só o realizado).
- Script: reaproveita `ScriptPanel` em modo compacto, com o `observacao`/`template_id` da campanha.
- `CorretorListSelection` é preservado e passa a ser renderizado só no modo "ver todas as listas"; `DialingModeWithScript` não muda de contrato (recebe a mesma `OALista`).
- Sem mudanças de banco, RLS ou edge functions. Apenas frontend.

## Fases (validando uma por vez)

- **Fase 0 — mockup**: HTML da tela de entrada + onboarding para sua aprovação visual.
- **Fase 1**: tela de entrada `/corretor/call` com campanha em destaque + "ver todas as listas".
- **Fase 2**: onboarding de 1 tela (meta, campanha, script) com "Começar a ligar".
- **Fase 3**: faixa de meta/placar no topo do discador + validação ao vivo no preview.
