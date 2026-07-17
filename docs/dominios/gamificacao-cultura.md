# Domínio 10 — Gamificação & Cultura

## 1. Propósito
Elementos motivacionais: rankings, conquistas, missões, Pulse (feed cultural interno), Academia (treinamento).

## 2. Tabelas
- `roleta_*` — **⚠️ CONFIRMAÇÃO**: a "roleta" no código é UMA SÓ (distribuição de leads). Não existe roleta de gamificação separada.
  - `roleta_config, roleta_credenciamentos, roleta_desbloqueios, roleta_distribuicoes, roleta_fila, roleta_segmentos, roleta_campanhas`
  - Todas as 7 tabelas são de **distribuição de leads**, não de sorteio/prêmio.
- `corretor_conquistas` (5 col, 4 policies) — badges conquistadas
- `academia_aulas, academia_trilhas, academia_progresso, academia_quiz, academia_quiz_perguntas, academia_certificados, academia_checklist`
- `pulse_events, pulse_reactions, pulse_desafios, pulse_desafio_contribuicoes` — feed cultural
- `corretor_onboarding` — 11 steps hard-coded em `useOnboarding.ts`
- `corretor_motivations`
- `marketplace_items, marketplace_ratings, marketplace_scripts, marketplace_usage`
- `saved_scripts, team_scripts` — biblioteca de scripts

## 3. Fluxo
```
Ação do corretor (ligação, visita, venda, aceite lead)
    ↓
Trigger/hook grava evento (pulse_events, corretor_conquistas)
    ↓
Feed Pulse renderiza no /corretor + /gerente
    ↓
Conquistas desbloqueiam via lógica em src/lib/gamification.ts + celebrations.ts

Academia:
UI /academia → useAcademia lê trilhas/aulas → progresso salvo em academia_progresso
Quiz correto → academia_certificados

Onboarding:
useOnboarding.ts (11 passos em 3 fases: Dia 1 config, Dia 1-3 ações, Semana 1)
Auto-detecção via queries em várias tabelas (perfil, disponibilidade, tentativas OA, pipeline_leads, visitas, homi_conversations)
```

## 4. Componentes/hooks
- `src/pages/AcademiaPage.tsx`, `AcademiaAulaPage.tsx`, `Conquistas.tsx`, `RankingEquipe.tsx`, `Onboarding.tsx`
- `src/components/immersive/AchievementUnlockedScreen.tsx`, `ImmersiveScreen.tsx`
- `src/components/pulse/*`, `src/components/ranking/*`, `src/components/scripts/*`
- `src/lib/gamification.ts`, `celebrations.ts`
- Hooks: `useAcademia`, `useConquistas`, `useOnboarding`, `useTeamOnboarding`, `usePulse`, `useMarketplace`

## 5. Edge Functions
Nenhuma dedicada a gamificação (tudo client-side + triggers).

## 6. Regras não óbvias
- **Onboarding: 11 passos hard-coded** em `useOnboarding.ts` (não em DB). Auto-detecta 7 deles via queries em várias tabelas.
- `isNewUser = created_at nos últimos 7 dias` — depois some da UI.
- Marketplace tem 4 tabelas mas sem edge function — feature client-only?

## 7. Decisões
- Roleta de gamificação **não existe** — o nome "roleta" refere-se exclusivamente à distribuição de leads.
- Onboarding hard-coded para evitar dependência de admin criar passos.

## 8. Dependências
Consome: `pipeline-funil` (ações que geram eventos), `admin-seguranca`. Produz: métricas para dashboards.

## 9. Perguntas
1. **Confirmado: só existe UMA "roleta" — a de distribuição de leads.** Havia intenção de criar gamificação com o mesmo nome? (Confirmar com fundador.)
2. `marketplace_items/ratings/scripts/usage` — 4 tabelas, mas sem edge function. Feature ativa ou draft?
3. Academia — quantos corretores completaram trilhas nos últimos 30d?
4. Onboarding 11 passos hard-coded — quer mover para DB?
5. Pulse é usado? `pulse_events` volume?
6. `saved_scripts` vs `team_scripts` vs `marketplace_scripts` — 3 fontes de scripts.
