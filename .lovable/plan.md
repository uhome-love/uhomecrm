# Remover bloqueio de "meta do dia" no /corretor

## Diagnóstico

O toast **"Defina sua meta do dia antes de iniciar o Call!"** vem de `src/pages/CorretorCall.tsx` (linhas 87‑95):

```tsx
const metaSalva = progressLoading || !!goals;

useEffect(() => {
  if (!progressLoading && !goals) {
    toast.warning("Defina sua meta do dia antes de iniciar o Call!");
    navigate("/corretor", { replace: true });
  }
}, [progressLoading, goals, navigate]);
```

Esse gate é o único bloqueio remanescente — ele ativa quando `corretor_daily_goals` está vazio para o dia. Como o conceito de "meta do dia" foi descontinuado, qualquer tentativa de entrar em `/corretor/call` cai nesse redirect.

O botão **Modo Foco** em `src/components/corretor/CaminhosCards.tsx` já abre o `FocusModeModal` localmente (`setFocusOpen(true)`) e não tem checagem de meta — vai ficar como está. O `FocusModeModal` em si também não exige meta.

## Mudanças

### 1. `src/pages/CorretorCall.tsx`
- Remover o `useEffect` que dispara o toast e redireciona quando `goals` é null.
- Remover a variável `metaSalva` e o `if (!metaSalva) return null;` (linhas 88 e 216).
- Remover o import de `toast` se ficar sem uso (verificar — provavelmente fica, mas confirmar).
- O resto da página continua funcionando: `useCorretorProgress` já retorna defaults (`metaLigacoes=30`, `metaAproveitados=5`, `metaVisitas=3`) via `useCorretorDailyStats`/`useCorretorDailyGoals` quando `goals` é null, então os cards de "Sua Missão de Hoje" exibem os números default sem quebrar.

### 2. `src/components/corretor/CaminhosCards.tsx`
- **Nenhuma mudança no redirect** — `Modo Foco` já chama `setFocusOpen(true)` corretamente, abrindo o `FocusModeModal` no próprio dashboard (conforme escolhido).
- Confirmar visualmente que o card `Modo Foco` (destaque dark gradient) abre o modal direto.

## Fora de escopo (não tocar)

- `DailyProgressCard.tsx` — continua existindo como UI opcional; usuário não pediu remover o conceito de meta da UI, só pediu para não bloquear botões.
- `FocusModeModal.tsx` e tela `FocusConfigScreen.tsx` — sem mudanças.
- `useCorretorProgress` / `useCorretorDailyStats` / `useCorretorDailyGoals` — mantidos, só não vão mais bloquear navegação.
- Sidebar, pageRegistry, rotas — sem mudanças.

## Validação

1. Abrir `/corretor` como corretor SEM meta cadastrada no dia.
2. Clicar em **Modo Foco** → `FocusModeModal` abre direto, sem toast, sem redirect.
3. Clicar em **Oferta Ativa** (`/corretor/call`) → tela "Modo Batalha" abre direto com `🔥 30 / ✅ 5 / 📅 3` (defaults), sem toast e sem voltar pro dashboard.
4. Console limpo, sem erro TS.

Estimativa: 2–3 min de build. Risco baixo (1 arquivo principal alterado).
