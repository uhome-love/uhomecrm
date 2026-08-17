# Remover os avisos de "o sistema mudou" (Nova Gestão)

Hoje existem dois avisos de mudança do CRM que já cumpriram o papel:

1. **Modal "O CRM mudou 🚀 / Nova Gestão Comercial"** — abre sozinho dentro do Pipeline de Leads.
2. **Guia da Nova Gestão** — tour que abre automaticamente na primeira entrada do corretor no CRM, com o botão 🎓 no cabeçalho e o atalho na Agenda ("ver o guia").

Ambos saem. Nada mais muda: o onboarding do corretor (card de etapas e página de checklist) continua como está.

## O que o usuário vai ver

- Ao abrir o Pipeline, nenhum popup de boas-vindas.
- Ao entrar no CRM, nenhum tour automático; o ícone 🎓 do cabeçalho desaparece.
- Na Agenda, some o link que reabria o guia (a caixinha "Como funciona" da fila permanece).

## Detalhes técnicos

- Excluir `src/components/pipeline/NovaGestaoOnboarding.tsx` e remover import + uso em `src/pages/PipelineKanban.tsx` (linhas 44 e 681).
- Excluir `src/components/pipeline/AgendaOnboarding.tsx` e limpar `src/components/AppLayout.tsx`: import, estado `onboardingOpen`, o `useEffect` do evento `open-onboarding`, a abertura automática por `jaViuOnboarding()`, o botão 🎓 (GraduationCap) e a renderização do componente.
- Em `src/pages/AgendaCorretor.tsx`, remover o botão que dispara `open-onboarding` (linha ~94).
- Remover o ícone `GraduationCap` do import se ficar sem uso.
- Sem mudanças de banco, RLS ou edge functions. As flags antigas em localStorage ficam órfãs e inofensivas.

## Validação

- Typecheck limpo.
- Preview: abrir o Pipeline (sem popup), recarregar o CRM (sem tour, sem 🎓) e abrir a Agenda (sem link do guia, resto intacto).
