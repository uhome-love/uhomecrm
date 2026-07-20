## Trocar o status auto-declarado pelo status real de presença

### Situação hoje
Na barra de status do corretor há um dropdown com 4 estados auto-declarados: Na Empresa / Em Plantão / Em Pausa / Offline. Grava em `profiles.status_online`. Confirmado:
- Ninguém consome isso pra decidir distribuição de leads.
- A distribuição real depende de credenciamento + presença marcada pelo gerente + fila da roleta.
- O único outro lugar que lê `status_online` é o `CheckpointCards` do gerente, apenas pra ordenar a lista, e já tem fallback para `isOnline` (última atividade). Ou seja, dá pra desligar sem quebrar nada.

### Novo fluxo
A pill da esquerda deixa de ser um dropdown auto-declarado e passa a refletir **o que o gerente marcou hoje** + um botão único de ação: **Sair**.

**Como monta o rótulo (regime já implementado):**

Seg–sex, dentro do horário:
- Turno atual = Manhã (até 12h) ou Tarde (12h–18h): mostra o status daquele turno do corretor
  - Sem marcação → `Aguardando presença` (cinza)
  - Presente → `Presente · Manhã 09:12` (verde) — hora vinda de `chegou_em`
  - Faltou → `Faltou · Manhã` (vermelho)
  - Saiu → `Saiu · 11:30` (âmbar)
- Fora do horário útil (antes de 7h ou depois de 18h em dia útil): mostra o consolidado do dia (`Presente hoje` / `Faltou hoje` / `Sem registro`).

Noturna (18h–23h30, seg–sex):
- Se credenciado noturno aprovado → `Presente (noturna, benefício)` — automático, sem botão de sair (benefício remoto).
- Se não credenciado → esconde.

Sábado:
- Credenciamento aprovado → `Presente (sábado)`; não credenciado após 23:59 → `Faltou (sábado)`.

Domingo:
- Credenciado + elegível → `Presente (domingo, benefício)`.
- Credenciado mas não elegível → `Não elegível (domingo)` com tooltip explicando o critério (≥4 presenças + ≥2 visitas na semana anterior).

**Botão "Sair" (substitui o dropdown de status):**
- Só aparece se o corretor está ativo em algum turno presencial do dia (Manhã ou Tarde, seg–sex) e ainda não foi marcado como Saiu/Faltou.
- Ao clicar: confirma "Sair da roleta agora? Você não recebe mais leads hoje."
- Ao confirmar, chama a RPC `roleta_marcar_presenca` com `status='saiu'` + `saiu_em=now()` para o turno atual, e a rotina que já existe: desativa credenciamentos do dia (`status='saiu'`) e a fila (`ativo=false`).
- Não aparece nos turnos automáticos (Noturna/Sábado/Domingo) — não faz sentido "sair" de benefício remoto.

### O que sai do código
- Dropdown `STATUS_OPTIONS` (Na Empresa/Em Plantão/Em Pausa/Offline) e função `updateStatus` — removidos de `RoletaStatusBar.tsx`.
- Estado local `status`, leitura e escrita em `profiles.status_online` — removidos deste componente.
- `CheckpointCards` continua funcionando (usa fallback `isOnline`).

### O que entra
- Componente novo `PresencaDoCorretorPill.tsx` em `src/components/corretor/`:
  - Recebe `profileId`; usa `useRoletaPresencas()` (já existe, com realtime); usa `getRegimeDoDia()` e `useElegibilidadeDomingo` (já existem).
  - Renderiza a pill de estado + botão "Sair" quando aplicável.
- `RoletaStatusBar.tsx` substitui a pill esquerda por esse componente. "Ativo na Roleta" e o botão de segmentos continuam intactos.

### Fora do escopo
- Não mexer na página Presença do gerente/CEO.
- Não mexer na tabela `profiles.status_online` no banco (deixa a coluna quieta; podemos deprecar num sweep futuro).
- Nada de agregado semanal no dashboard do corretor.
- Widget zerado do plano anterior segue removido.

### Detalhes técnicos
- Turno atual em BRT: reaproveitar helper de `getRegimeDoDia`/`roletaPresenca`.
- RLS: confirmar que o corretor lê os próprios registros em `roleta_presencas` (se falhar, adicionar policy `corretor_read_own`). RPC `roleta_marcar_presenca` já valida quem pode marcar `saiu` — permitir o próprio corretor marcar `saiu` no próprio registro caso não permita hoje.
- Ordenação em `CheckpointCards`: aceitável ficar só com `isOnline` (última atividade) enquanto ninguém mais grava `status_online`.
- Feriados: se `isHolidayBRT()` true, tratar como domingo (benefício).
