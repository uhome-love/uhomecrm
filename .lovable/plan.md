# Atividade como forma de atualizar — novo fluxo de trabalho do corretor

Substitui o modelo atual ("a vida gira em torno de criar e concluir tarefa") por:
**registrou atividade = lead atualizado**. Tarefa vira compromisso/lembrete, não fluxo obrigatório.

---

## 1. O diagnóstico com os números reais

| Fato | Número |
|---|---|
| Tarefas criadas em 30 dias | 11.496 |
| Tarefas **canceladas** em 30 dias | 2.588 (22,5%) |
| Tarefas pendentes / atrasadas hoje | 1.780 / **556** |
| Tarefas por lead (90d) | média 4,6 · **554 leads com 10+** |
| Tarefas por etapa (safra 90d) | Aquecimento **7,1** · Venda **4,1** |

Quem vendeu teve MENOS tarefas que quem está travado. Volume de tarefa não é progresso.

### O achado mais grave: o "em dia" de hoje é falso

`ultima_acao_at` (o campo que alimenta pílulas, Modo Foco e estagnação) é atualizado por
qualquer mexida em tarefa. Comparando com **toque real** (ligação, WhatsApp, visita, proposta, e-mail):

| Etapa | Leads | Dias sem toque (mediana) — campo atual | Dias sem toque **real** | Sem toque real >7d | >14d |
|---|---|---|---|---|---|
| Qualificação | 691 | 1 | **15** | 457 | 354 |
| Aquecimento | 557 | 2 | **20** | 437 | 384 |
| Pós-Visita | 75 | 1 | **11** | 42 | 34 |
| Visita | 60 | 2 | 4 | 27 | 22 |
| Proposta | 24 | 4 | 12 | 16 | 9 |

**1.417 leads sem contato real há mais de 7 dias aparecem como saudáveis.** O CRM hoje mede
manutenção de tarefa, não atendimento. É isso que o novo fluxo corrige.

---

## 2. O modelo novo em uma frase

> **Atividade atualiza. Tarefa lembra. Dias sem atividade cobram.**

Três estados de saúde do lead, calculados por **dias desde a última atividade real**:

```text
ATIVIDADE REGISTRADA ──► contador zera
        │
   0 ── EM DIA ──► DESATUALIZADO ──► ESTAGNADO
        (verde)      (âmbar)          (vermelho)
                     avisa o corretor  entra na régua do gestor
```

Nomenclatura (nada de "predisposição"): **Em dia · Desatualizado · Estagnado**.
No card e nos filtros aparece sempre "**há X dias sem contato**".

---

## 3. O que conta como atividade (a verdade)

Zera o contador:
- Ligação (atendeu ou não atendeu)
- WhatsApp enviado pelo corretor
- E-mail / envio de material / proposta enviada
- Visita agendada, confirmada, realizada ou no-show
- Reunião / retorno registrado
- Nota do corretor com conteúdo
- Mudança de etapa **acompanhada de registro** (a mudança sozinha não zera)

**Não zera:** criar tarefa, adiar tarefa, cancelar tarefa, editar campo do lead, abrir o lead.
É exatamente aqui que o número de hoje mente.

Tecnicamente: novo campo `ultimo_toque_at` no lead, alimentado só por atividade real.
`ultima_acao_at` fica como está (não quebra nada) mas deixa de ser fonte de saúde.

---

## 4. Régua de dias por etapa

Definida a partir do ciclo real de cada etapa (tabela acima) e do ritmo comercial da casa:

| Etapa | Desatualizado | Estagnado | Por quê |
|---|---|---|---|
| Novo Lead | 1 dia | 2 dias | velocidade de resposta é tudo |
| Sem Contato | *(cadência atual, intocada)* | 7 tentativas | regra de banco existente |
| Qualificação | **4 dias** | **10 dias** | mediana real 15d — precisa apertar |
| Aquecimento / Nutrição | **10 dias** | **21 dias** | ritmo naturalmente mais lento |
| Visita | **2 dias** | **5 dias** | visita marcada esfria rápido |
| Pós-Visita | **2 dias** | **5 dias** | janela de decisão curta |
| Em Negociação / Proposta | **3 dias** | **7 dias** | dinheiro na mesa |
| Contrato | **3 dias** | **7 dias** | pendência operacional |

Valores ficam em `pipeline_estagnacao_config` (tabela que já existe, hoje só com 2 etapas),
editáveis pelo gestor — não hardcoded.

---

## 5. Como funciona na prática, ponta a ponta

### 5.1 Entrada e Sem Contato (sem mudança)
Lead entra → roleta/Fila do CEO → aceite → **Sem Contato** com a cadência de tarefas de hoje,
que continua exatamente como está (regra de banco `trg_cadencia_sem_contato`).
Ao primeiro contato atendido, o lead vai para Qualificação e **sai do regime de tarefa obrigatória**.

### 5.2 A partir de Qualificação — o novo pop-up

Quando o corretor move o lead de etapa, abre o **Registrar atividade**:

```text
┌── Mover para Qualificação ───────────────────┐
│  O que aconteceu?                            │
│  [📞 Falei]  [📵 Não atendeu]  [💬 WhatsApp] │
│  [🏠 Marquei visita]  [📄 Proposta]  [📝 Nota]│
│                                              │
│  Situação: (chip da etapa) ▾                 │
│  Observação (opcional) .................     │
│                                              │
│  Quer criar um lembrete?                     │
│   ( ) Não precisa   (•) Sim → [data] [hora]  │
│                                              │
│              [Registrar]                     │
└──────────────────────────────────────────────┘
```

- **Registrar** grava a atividade, atualiza o substatus, zera o contador e, se existir tarefa
  pendente compatível, **fecha sozinha** (sem diálogo extra).
- O lembrete é **opcional**. Se não criar, o lead simplesmente entra na régua de dias.
- O mesmo pop-up é acessível sem mover etapa, pelo botão fixo **"Registrar atividade"** no
  detalhe do lead e pela barra rápida no card (evolução do `QuickActionMenu`, que já existe).

### 5.3 O ciclo depois disso

```text
registrou ──► EM DIA (verde, some dos alertas)
   │
   ├─ passou o limite de desatualização ──► card fica âmbar
   │        "há 6 dias sem contato" + entra no Modo Foco do corretor
   │
   ├─ registrou de novo ──► contador zera, volta a verde
   │
   └─ passou o limite de estagnação ──► card vermelho
            entra no painel do GESTOR (devolver / repassar / roleta / descartar —
            RPC `decidir_lead_estagnado`, que já existe)
```

O corretor nunca é "punido" por não criar tarefa. Ele é cobrado por **silêncio**.

### 5.4 Tarefa, no modelo novo
- É **lembrete pessoal**: aparece na agenda do dia e notifica.
- Nunca bloqueia registro de atividade.
- **Nunca mais é obrigatória para atualizar** (fim do `NextActionModal` obrigatório).
- Continua **automática** só onde é regra de negócio: Sem Contato, fluxo de Visita
  (confirmar → registrar resultado, 1 card por vez), retorno de nutrição e prazo externo
  estourado em Negociação.
- Tarefa vencida deixa de gerar o alerta principal — vira um sinal a mais dentro do
  "dias sem contato".

---

## 6. Ordem de visualização dos leads

Recomendação (você sugeriu "recente" — eu ajusto para funcionar melhor na prática):

**Ordem padrão do Kanban = "Precisa de mim"**, que é uma escada simples e lida em 1 segundo:

```text
1º  Estagnado (vermelho) ......... mais dias sem contato primeiro
2º  Desatualizado (âmbar) ........ mais dias sem contato primeiro
3º  Compromisso de hoje .......... lembrete ou visita marcada hoje
4º  Em dia (verde) ............... mais recente primeiro
```

Por que não "recente" puro: recente é ótimo para achar o lead que você acabou de tocar, mas
faz o corretor trabalhar sempre nos mesmos e esquecer os 1.417 sem toque. A escada acima
resolve o esquecimento e ainda deixa o recente no topo *dentro* do verde.

Alternativas disponíveis num seletor (a preferência fica salva por corretor):
**Precisa de mim** (padrão) · **Mais recente** · **Mais antigo sem contato** · **Termômetro** · **Valor**.

---

## 7. Modo Foco redesenhado

Hoje é 100% tarefa (`sem tarefa`, `vence em 2 dias`, `visita sem follow-up`). Passa a ser:

| Fila | Regra |
|---|---|
| 🔴 **Estagnados** | passou o limite da etapa — resolver ou devolver |
| 🟠 **Desatualizados** | passou o limite de desatualização |
| 🏠 **Visita sem desfecho** | visita realizada sem atividade depois (mantida) |
| 📅 **Compromissos de hoje** | lembretes e visitas do dia |

Cada card do Foco abre direto no **Registrar atividade** — 2 cliques por lead.
Ao final: "Você atualizou 12 leads hoje. 4 continuam sem contato há mais de 10 dias."

---

## 8. Filtros e pílulas do pipeline

As pílulas atuais (`em dia` / `sem tarefa` / `atrasado`) trocam para:

```text
● Em dia (n)   ● Desatualizados (n)   ● Estagnados (n)   ● Compromisso hoje (n)
```

Mais um filtro numérico: **"sem contato há mais de ___ dias"** (3 / 7 / 14 / 30), usável
por corretor, gestor e CEO, e exportável.

---

## 9. Como outros CRMs resolvem isso (e o que eu peguei de cada um)

- **Salesforce / HubSpot — "days since last activity"**: campo nativo, filtrável, base de
  relatório de higiene. É exatamente o contador que estamos criando. Lição: o dado só vale
  se for **atividade real**, não edição de registro.
- **Pipedrive — "rotten deals"**: negócio apodrece após X dias sem atividade, com X **por etapa**
  e configurável. Lição: régua por etapa (nosso item 4), não um número único.
- **Pipedrive / Close — "activity-based selling"**: o KPI do time é atividade/dia, não tarefa
  concluída. Lição: trocar a meta do corretor (item 10).
- **Close / Outreach — one-click logging**: registrar chamada é 1 clique e já pergunta o
  próximo passo de forma opcional. Lição: nosso pop-up com lembrete opcional.
- **O erro comum documentado**: obrigar próxima tarefa gera "tarefa fantasma" — o vendedor
  cria por criar e depois cancela. Nossos **2.588 cancelamentos em 30 dias** são exatamente isso.

---

## 10. Cobrança e engajamento (para não virar bagunça)

- **Meta do corretor**: atividades/dia e **leads tocados/dia** (hoje já registramos ~9.675
  atividades/mês, então a base existe), no lugar de tarefas concluídas.
- **Placar diário** simples no dashboard: "leads tocados hoje: 8 · em dia: 74% da carteira".
- **Cobrança automática ao corretor**: 1 resumo por dia (manhã), não notificação por lead.
- **Cobrança ao gestor**: só estagnados. O gestor não vê ruído de âmbar.
- **Carteira saudável = % de leads em dia** — vira KPI de 1:1 e do dashboard do gestor.

---

## 11. Impacto no resto do CRM (nada quebra)

| Área | Efeito |
|---|---|
| Sem Contato | intocado (cadência de banco) |
| Central de Tarefas / Agenda | continuam existindo; tarefa vira lembrete |
| Motor de estagnação | passa a usar `ultimo_toque_at` + régua por etapa; RPCs de decisão mantidas |
| Dashboard gestor v4 / CEO | pílula "carteira em dia" substitui "sem tarefa" |
| PDN | inalterado |
| Nutrição / Reengajamento | resposta do lead conta como atividade e zera o contador |
| Relatórios de tarefa | seguem funcionando (dado histórico preservado) |
| CAPI / visitas | inalterados |

---

## 12. Fases de execução

- **H1 — Verdade do contador**: campo `ultimo_toque_at` + backfill + função de dias sem
  contato. Nada muda na tela. Permite comparar o número novo com o atual antes de trocar.
- **H2 — Registrar atividade**: pop-up único, lembrete opcional, fechamento automático de
  tarefa compatível. Aplicado primeiro em Qualificação.
- **H3 — Saúde visual**: cores/labels no card, pílulas novas, filtro "sem contato há X dias",
  nova ordenação.
- **H4 — Modo Foco por dias sem contato.**
- **H5 — Motor de estagnação** na régua nova + painel do gestor + resumo diário.
- **H6 — Metas e placar** de atividade; aposentar o `NextActionModal` obrigatório.

Cada fase é validada ao vivo no preview (desktop e 440px), com lead de teste, e tem rollback escrito.

---

## 13. Decisões que preciso de você antes do build

1. A régua de dias da tabela do item 4 está boa, ou quer apertar/afrouxar alguma etapa?
2. Ordem padrão "Precisa de mim" — fecha, ou prefere "Mais recente" como padrão?
3. Mudança de etapa sem registrar atividade: **bloqueia** (obriga o pop-up) ou **permite** e
   só não zera o contador? Minha recomendação: obriga só na primeira entrada em Qualificação.
