# Fix responsivo — Botões de Presença sobrepondo em telas médias

## Diagnóstico (validado no screenshot em 1277px CSS)

Em `src/components/roleta/PresencaRoletaPanel.tsx`, o `TurnoChip` renderiza numa linha flex fixa:

```
[Manhã w-14] [SEM MARCAR pill] [🎯 badge] [botões ml-auto: Presente + Faltou]
```

E o `CorretorRow` usa grid de turnos `sm:grid-cols-2 md:grid-cols-3` — ou seja, a partir de 768px cada chip recebe ~1/3 do lado direito da linha. Nesse tamanho:

- O rótulo dos botões só some abaixo de `lg` (≥1024): `<span className="hidden lg:inline">`. Entre `md` (768) e `lg` (1024), aparece **texto + ícone** num chip curto → botões extrapolam a largura do chip e **vazam por cima do chip vizinho** (efeito visível na captura: "Presente"/"Faltou" do Manhã sobrepondo o "SEM MARCAR" do Tarde).
- Mesmo em `lg`, quando um corretor tem 3 turnos (Manhã + Tarde + Noturna auto) e há 2 botões visíveis num chip (`Presente + Faltou`), o conteúdo estoura o chip.
- O container do chip não tem `min-w-0` nem `overflow` de contenção; o `ml-auto` empurra os botões pra fora do fluxo em vez de forçar quebra.

## Escopo

Apenas UI/UX responsiva do painel de Presença — sem alterar regras de negócio, estados, mutations ou banco. Arquivo único:

- `src/components/roleta/PresencaRoletaPanel.tsx`

## Mudanças

### 1) `TurnoChip` — conter overflow e permitir quebra

- Adicionar `min-w-0` e `flex-wrap` no container flex.
- Trocar `w-14` do label do turno por `min-w-0 shrink` com `truncate` (ainda em `text-[11px] font-semibold`) — libera espaço quando o chip é estreito.
- Fazer o badge de estado (`SEM MARCAR`/`PRESENTE`/etc.) receber `shrink-0` para não quebrar em duas linhas.
- Grupo de botões (`ml-auto flex gap-1`) recebe `shrink-0` e passa a quebrar para a linha de baixo em telas apertadas em vez de sobrepor.

### 2) Botões — ícone-only até `xl`, texto a partir de `xl`

Hoje: `hidden lg:inline` no texto → mostra texto entre 1024–~1280 onde não cabe.

Novo: `hidden xl:inline` (≥1280) para "Presente" / "Faltou" / "Saiu". Nos tamanhos intermediários fica só o ícone com `aria-label` e `title` (já existem os `title`), garantindo acessibilidade.

Complemento: adicionar `aria-label` explícito em cada botão para leitores de tela quando o texto está oculto.

### 3) Grid de turnos no `CorretorRow` — degrau extra

Trocar `grid-cols-1 sm:grid-cols-2 md:grid-cols-3` por `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`:

- <768px: 1 turno por linha (mobile, já ok).
- 768–1279px: 2 turnos por linha (dois chips confortáveis lado a lado).
- ≥1280px: 3 turnos por linha (Manhã/Tarde/Noturna).

Ajustar o placeholder `!mostrarNoturna && <div className="hidden xl:block" />` para acompanhar o novo breakpoint.

### 4) Coluna esquerda do `CorretorRow`

Manter, mas trocar `md:grid-cols-[minmax(180px,220px)_1fr]` por `lg:grid-cols-[minmax(180px,220px)_1fr]` — em `md`, a identidade fica em cima e turnos embaixo (2 colunas de chips), o que dá muito mais respiro sem sobreposição.

### 5) `WeekendPanel` (Sábado/Domingo)

Mesmo tratamento no botão "Saiu" do painel de fim de semana (linha ~518): `hidden xl:inline` + `aria-label`. Sem outras mudanças.

## Não muda

- Nenhuma lógica de mutação, RPC, elegibilidade, cron, regime dia útil/sábado/domingo, credenciamento, ou estados.
- Nenhum outro componente/página fora do arquivo `PresencaRoletaPanel.tsx`.

## Validação após build

1. `/roleta/presenca` em viewport 1277px (o do usuário): 2 chips por linha, botões com ícone só, sem sobreposição.
2. Viewport ≥1280px: 3 chips por linha com texto nos botões.
3. Mobile (<768px): 1 chip por linha, empilhado, botões íconados.
4. Corretor com noturna (auto-presente) e sem noturna: layout consistente, sem gaps quebrados.
5. Fluxo funcional: clicar Presente/Faltou/Saiu continua abrindo o `RegistrarHorarioDialog` e disparando a mutation atual.
