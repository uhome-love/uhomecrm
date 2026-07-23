## Contexto

Auditoria ponta a ponta do `/oferta-ativa-ao-vivo` executada para as visões de CEO, gestor e corretor. Foram identificados **2 bloqueios críticos** que impedem o uso seguro às 10h:

1. **Ação "Pular" falha com erro 500** — a edge function `oferta-ativa-registrar-resultado` tenta inserir `resultado='pulado'` na tabela `oferta_ativa_ligacoes`, mas a `CHECK` constraint da coluna só aceita `aproveitado`, `nao_atendeu`, `sem_interesse`, `visita_agendada`. Resultado: toast "Edge Function returned a non-2xx status code" e o corretor fica travado no lead atual.
2. **Não existe URL dedicada `/placar-tv` para a TV da empresa** — o botão "Placar TV" abre `/oferta-ativa-ao-vivo?view=tv`, que renderiza dentro do `AppLayout` com sidebar visível. Para uso em TV/externo é necessária uma rota limpa sem o chrome do CRM.

O Painel Ao Vivo, Ranking, Onboarding, Filtros multi-select, Configurações e Placar TV (dentro da aba) renderizam corretamente.

## Escopo de correção

### 1. Migration — adicionar `pulado` ao resultado de `oferta_ativa_ligacoes`

- Remover e recriar a `CHECK` constraint `oferta_ativa_ligacoes_resultado_check` incluindo `'pulado'` no array permitido.
- A ação de pular é registrada como uma linha na tabela de ligações com `contaLigacao=false` (já implementado na edge function), mas precisa ser permitida pelo schema.

### 2. Nova rota `/placar-tv` (página dedicada para TV)

- Criar `src/pages/PlacarTv.tsx` que busca a sessão ao vivo atual (`status='ao_vivo'`, `inicio_at <= now <= fim_at`) e renderiza o componente `PlacarTv` já existente.
- Adicionar rota `<Route path="/placar-tv" />` em `src/App.tsx` **dentro do ProtectedRoute** (mantém segurança — a TV precisará estar logada com um usuário do CRM).
- A página não usa `AppLayout`; é fullscreen, sem sidebar, ideal para projeção externa.
- Atualizar o botão "📺 Placar TV" em `src/pages/OfertaAtivaAoVivo.tsx` para apontar para `/placar-tv` em vez de `/oferta-ativa-ao-vivo?view=tv`.

## Arquivos que serão alterados

- Migration: `add_pulado_to_oa_ligacoes_resultado`
- `src/App.tsx` — adicionar rota `/placar-tv`
- `src/pages/PlacarTv.tsx` — novo arquivo
- `src/pages/OfertaAtivaAoVivo.tsx` — atualizar URL do botão Placar TV

## Como validar ao vivo

1. CEO: abrir `/oferta-ativa-ao-vivo` → Painel Ao Vivo deve continuar mostrando corretores e rankings.
2. Corretor: iniciar onboarding, pegar lead, clicar em **Pular** — deve trocar de lead sem erro.
3. Corretor: clicar em **Não atendeu** — deve liberar o lead e aplicar cooldown (já funcionando).
4. CEO/Gestor: clicar em **📺 Placar TV** — deve abrir `/placar-tv` em nova aba, fullscreen, sem sidebar, com ranking atualizado.
5. Placar TV: aguardar novo resultado "visita_agendada" para confirmar o flash/efeito sonoro.

## Nota de segurança

A rota `/placar-tv` será protegida (requer login). Se o objetivo for exibição em uma TV sem usuário logado, precisaremos discutir uma conta fixa de serviço ou tornar a edge function de ranking anônima — isso é uma decisão de segurança que não tomaremos sem aprovação.