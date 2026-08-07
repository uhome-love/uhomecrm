# Saída de corretor: mandar leads para Descarte

Hoje, ao inativar ou excluir alguém em Meu Time, a única saída é repassar tudo para outro corretor. O plano adiciona uma segunda opção: **mandar a carteira dele para Descarte** (leads frios voltam para reengajamento/oferta ativa), protegendo os leads quentes.

## Regras acordadas

- **Leads em etapas iniciais** (Novo Lead, Sem Contato, Qualificação, Aquecimento, Visita, Pós-Visita) → vão para **Descarte** como reengajáveis, com motivo "Corretor desligado".
- **Leads avançados** (Em Negociação, Contrato, Ganho, ou com negócio aberto) → vão para o **gerente do corretor**, que recebe uma **notificação** listando quantos leads recebeu.
- **Negócios** → sempre para o gerente (nunca descartados).
- **Tarefas pendentes** dos leads descartados → **canceladas** (some a "tarefa fantasma"). Tarefas dos leads avançados acompanham o gerente.
- Se o corretor não tiver gerente definido, a tela pede um destino manual para os avançados antes de permitir salvar.

## Como fica a tela (Meu Time → Inativar/Excluir)

No diálogo atual, o bloco "Repassar leads / negócios / tarefas" ganha uma escolha de destino da carteira:

```text
Destino da carteira
( ) Repassar tudo para outro corretor        <- comportamento atual
(•) Descartar leads frios + avançados p/ gerente

  Leads que vão para Descarte:      128
  Leads avançados p/ [Gerente X]:     6
  Negócios p/ [Gerente X]:            2
  Tarefas pendentes canceladas:      41
```

A prévia de impacto passa a mostrar esses 4 números antes de confirmar. O restante (absorver time, confirmação de nome na exclusão) continua igual.

## Fases

**Fase 1 — Backend**
Nova opção `lead_destination: "descarte"` nas ações `inactivate_user` e `delete_user` da função `create-broker-user`, com uma rotina `descartarCarteira()` que:
1. Move leads das etapas iniciais para a etapa Descarte, marcando `tipo_descarte='reengajavel'`, `motivo_descarte='Descartado: Corretor desligado'`, `motivo_descarte_code`, `stage_changed_at`.
2. Repassa leads avançados + negócios + visitas ao gerente (mesma mecânica do `reassignData` já existente).
3. Cancela tarefas pendentes dos leads descartados.
4. Cria notificação para o gerente com o resumo.
5. Registra tudo no `audit_log`.

**Fase 2 — Frontend**
`InativarOuExcluirDialog.tsx` ganha o seletor de destino, a prévia com os 4 números (consultas de contagem por etapa e por negócio aberto) e a exibição do gerente que vai receber os avançados. Quando o destino é Descarte, o campo "corretor destino" deixa de ser obrigatório na exclusão.

**Fase 3 — Validação ao vivo**
Testar no preview com um usuário de teste: prévia dos números, inativar com Descarte, conferir no pipeline que os leads frios estão em Descarte como reengajáveis, os avançados no gerente, tarefas canceladas e a notificação do gerente chegando. Sempre cancelando em leads reais.

## Detalhes técnicos

- Arquivos: `supabase/functions/create-broker-user/index.ts`, `src/components/team/InativarOuExcluirDialog.tsx`.
- Reusar: `reassignData()` (já existe e cobre leads/negócios/tarefas/visitas), o padrão de motivo de descarte de `src/lib/leadOutcome.ts` + `src/lib/discardReasons.ts`, e a função `criar_notificacao` do banco.
- Etapa Descarte: resolvida em runtime por `pipeline_stages.tipo = 'descarte'` (nunca UUID fixo).
- Etapas consideradas avançadas: `proposta`, `contrato_gerado`, `venda`, ou lead com `negocio_id` preenchido. `caiu`/`descarte` ficam como estão.
- Gerente do corretor: `team_members.gerente_id` do usuário-alvo.
- **Sem migration** — só função edge + frontend.
- Risco: operação em massa numa carteira grande; mitigado fazendo updates em lote por etapa e registrando o resultado no audit log. Nenhuma exclusão de lead acontece.

## Conflitos e armadilhas encontrados no código

- `delete_user` hoje **exige** `reassign_to`; precisa aceitar o caminho "descarte" sem destino.
- `reassignData` move a carteira inteira sem filtro por etapa; a nova rotina precisa filtrar antes, não depois.
- Se o corretor for gerente de alguém, a regra atual de "absorver o time" continua valendo e é independente desta escolha.
