# Estudo do Pipeline U.Home — diagnóstico e reorganização (visão de Diretor Comercial)

## 1. Diagnóstico com os números reais de hoje

Leads ativos por etapa (não arquivados) e tempo médio parado na etapa:

| Etapa | Leads | Parados >14d | Dias médios na etapa |
|---|---|---|---|
| Novo Lead | 38 | 0 | 0,5 |
| Sem Contato | 256 | 11 | 4,7 |
| **Qualificação** | **691** | **386** | **16,6** |
| **Aquecimento** | **557** | **352** | **38,0** |
| Visita | 60 | 26 | 28,7 |
| Pós-Visita | 75 | 0 | 6,5 |
| Em Negociação | 24 | 11 | 14,7 |
| Contrato | 2 | 0 | 4,5 |
| Ganho | 80 | — | — |
| Descarte | 59 | 2 | 3,1 |

Conversão da safra dos últimos 90 dias (3.856 leads criados):
- chegaram em Qualificação: 724 (18,8%)
- chegaram em Visita/Pós-Visita: 242 (6,3%)
- Ganho: 10 (0,26%)

Leitura honesta: **o funil funciona, mas trava em dois pontos e perde clareza em um terceiro.**

### Trava 1 — Qualificação é um depósito, não uma etapa
691 leads, 56% deles parados há mais de 14 dias, 16,6 dias de média. E **220 leads (30%) estão sem nenhum substatus preenchido** — ou seja, o corretor moveu o card e não disse em que ponto está. Dentro de Qualificação convivem hoje 5 realidades muito diferentes: contato inicial, alinhamento de perfil, busca de imóvel, follow-up e alinhando visita. São 5 microetapas escondidas atrás de um único nome. É exatamente a dor que você descreveu.

### Trava 2 — Aquecimento virou cemitério com nome bonito
557 leads, 63% parados >14 dias, 38 dias de média. Pior: 103 estão sem prazo definido (30/60/90) e existem leads em Aquecimento com `status_visita: realizada` e `status_visita: marcada` — ou seja, **leads que já visitaram estão parados numa etapa de espera**. Aquecimento hoje absorve dois grupos distintos que precisam de tratamento oposto: "quer, mas não agora" (nutrição por prazo) e "sumiu no meio do atendimento" (recuperação).

### Trava 3 — Visita está furada
Só 60 leads em Visita e 75 em Pós-Visita, enquanto há visita marcada/realizada registrada dentro de Aquecimento e Qualificação (`alinhando_visita`, 25 leads). Marcada / realizada / no-show hoje são substatus com comportamentos completamente diferentes: marcada é compromisso com data, realizada é decisão, no-show é recuperação urgente.

### O que já está bom (não mexer)
- Novo Lead e Sem Contato: 0,5 e 4,7 dias de média — a entrada está saudável e o SLA está funcionando.
- Pós-Visita: 0 leads parados >14 dias, 100% com substatus e 100% com tarefa pendente. É a etapa mais bem operada do CRM — e é justamente a mais nova e a mais estreita. Isso prova a tese: **etapa estreita com tarefa obrigatória funciona.**
- Disciplina de tarefas é alta: 5.084 follow-ups concluídos em 60 dias, e só 23 leads em Qualificação sem tarefa pendente. O corretor usa a ferramenta; o problema é o mapa, não o operador.

### Resposta direta às suas perguntas
- **O número de etapas está ok?** Sim em quantidade (7 ativas é o certo para um Kanban usável), **não em distribuição de peso**. 2 etapas concentram 71% dos leads ativos.
- **É desorganizado?** O funil não; a Qualificação sim.
- **Funciona em %?** Como fluxo de entrada, ~90%. Como fluxo de meio de funil, ~45%. Como leitura gerencial (saber onde o lead realmente está), ~60% — porque 30% dos cards não têm substatus.
- **Tem harmonia?** Não: Novo Lead/Sem Contato/Pós-Visita são precisos; Qualificação/Aquecimento são vagos.
- **O que eu mudaria?** Nada no Kanban principal. Mudaria **o que acontece quando você clica na etapa.**

---

## 2. A solução: subfunil dentro da etapa (sem quebrar nada)

Sua intuição está certa e é a saída correta: **não adicionar colunas ao Kanban** (10+ colunas num board é ilegível no notebook do corretor e impossível no celular), e sim **abrir um subfunil Kanban ao clicar no cabeçalho da etapa**.

O Kanban principal continua exatamente como está — 7 etapas, mesmas regras, mesmas automações, mesmo drag-and-drop. Nada de migration de etapa, nada de lead mudando de lugar.

```text
KANBAN PRINCIPAL (inalterado)
Novo Lead │ Sem Contato │ Qualificação │ Aquecimento │ Visita │ Em Negociação │ Contrato
                              ▲ clique no cabeçalho
                              │
              ┌───────────────┴─────────────────────────────────┐
              │  SUBFUNIL — QUALIFICAÇÃO (drawer tela cheia)    │
              │  Contato   Perfil   Busca   Follow-up  Alinhando│
              │  inicial   alinhado imóvel             visita   │
              │   38        125      27       55         25     │
              │  + coluna "⚠ Sem status" (220) — força triagem  │
              └─────────────────────────────────────────────────┘
```

Arrastar um card dentro do subfunil **não muda a etapa** — só grava o substatus em `flag_status`, que é exatamente o campo que já existe hoje. Zero risco para PDN, relatórios, CAPI, roleta ou metas, porque a etapa (`stage_id`) permanece intacta.

### Subfunis propostos (usando os substatus que já existem)

| Etapa | Colunas do subfunil |
|---|---|
| Qualificação | Contato inicial · Alinhamento de perfil · Busca de imóvel · Follow-up · Alinhando visita · ⚠ Sem status |
| Aquecimento | 30 dias · 60 dias · 90 dias · ⚠ Sem prazo |
| Visita | Marcada · Realizada · No-show |
| Em Negociação | Proposta enviada · Proposta aprovada · Aprovação bancária · Correspondente · Aprovação proprietário · Documentação |
| Contrato | Em confecção · Gerado · Em leitura |

A coluna **"⚠ Sem status"** é o coração do ganho: hoje ela teria 220 leads em Qualificação e 103 em Aquecimento. É a primeira vez que o gestor vê, num só lugar, tudo que está sem endereço dentro do funil.

### Regra de higiene que destrava as duas etapas gordas
Ao mover um card **para** Qualificação, Aquecimento, Visita ou Em Negociação, o CRM pede o substatus (usando o modal de próxima ação que já existe) — 1 clique, não um formulário. Isso mata o problema na origem em vez de limpar depois.

### Ajuste de rota que resolve a Trava 3
Lead com `status_visita` preenchido não pode ficar em Aquecimento. Regra: registrou visita marcada → o card vai para Visita. Isso já é o comportamento esperado pela regra de agenda; hoje há desvio (17 leads com visita registrada presos em Aquecimento).

---

## 3. Página de Descartes por motivo (exclusiva CEO)

Hoje `motivo_descarte` é **texto livre** e está caótico: existem "Descartado: Não atende / não responde" (498), "Descarte: Não atende / não responde" (188+48+37 em variações), "Descarte: nao atende | Empreendimento: Casa Tua" (67)... o mesmo motivo aparece em 6 grafias diferentes, e 82 registros estão com `tipo_descarte` nulo.

Proposta: nova rota **`/descartes`** visível só para CEO/admin, com:
- **Normalização na leitura** (não no banco): uma camada que agrupa as variações em ~10 motivos canônicos — Não atende, Sem retorno, Sem interesse, Sem condição financeira, Sem perfil, Contato errado, Não quer contato / LGPD, Desistiu, Estagnação, Outro.
- Ranking de motivos com % do total, e corte **reengajável × definitivo**.
- Recortes por corretor, equipe, empreendimento, origem e período (BRT).
- Cruzamento com a etapa de onde o lead foi descartado — responde "estamos perdendo antes ou depois do contato?".
- Botão para exportar e para mandar a fatia reengajável direto para a Base Única / campanha de Oferta Ativa (reaproveitando o fluxo que já existe).

---

## 4. Ordem de execução sugerida (fases pequenas, mockup antes de cada uma)

- **Fase A — Subfunil de Qualificação.** Só uma etapa, para validar a mecânica no uso real dos corretores. É onde está a maior dor (691 leads).
- **Fase B — Higiene de substatus.** Pedir substatus ao entrar na etapa + coluna "⚠ Sem status" ativa nos demais subfunis.
- **Fase C — Subfunis de Aquecimento, Visita, Em Negociação e Contrato** + correção da rota de visita presa em Aquecimento.
- **Fase D — Página `/descartes` do CEO** com motivos normalizados.

## 5. Notas técnicas

- Nada de migration de `pipeline_stages` nas Fases A–C: o subfunil grava apenas em `pipeline_leads.flag_status` (jsonb), campo já em produção e já lido por `leadHelpers.ts` (`QUALIFICACAO_SUBSTATUS`, `AQUECIMENTO_SUBSTATUS`, `VISITA_SUBSTATUS`, `NEGOCIACAO_SUBSTATUS`, `CONTRATO_SUBSTATUS`).
- O subfunil é um componente novo (drawer/full-screen) que reusa o card atual do Kanban; o board principal não é tocado.
- A correção "visita registrada não fica em Aquecimento" mexe em rota de etapa e deve ser tratada em fase própria, com auditoria dos 17 casos antes.
- A página `/descartes` é leitura + normalização em view/RPC; sem alterar `motivo_descarte` histórico (preserva auditoria). A padronização dos motivos daqui pra frente pode virar lista fixa no `DiscardLeadDialog` numa fase futura.
