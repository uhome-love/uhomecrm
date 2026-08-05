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

Conversão da safra dos últimos 90 dias (3.856 leads criados): Qualificação 724 (18,8%) · Visita/Pós-Visita 242 (6,3%) · Ganho 10 (0,26%).

Leitura honesta: **o funil funciona, mas trava em dois pontos e perde clareza em um terceiro.**

- **Trava 1 — Qualificação é depósito.** 691 leads, 56% parados >14 dias, e **220 (30%) sem nenhum substatus**.
- **Trava 2 — Aquecimento é cemitério.** 557 leads, 63% parados >14 dias, 38 dias de média, 103 sem prazo.
- **Trava 3 — Visita furada.** Só 60 em Visita enquanto marcada/realizada aparece dentro de Aquecimento e Qualificação (`alinhando_visita`, 25 leads).

**O que já está bom:** Novo Lead e Sem Contato (0,5 e 4,7 dias). E Pós-Visita: 0 parados >14 dias, 100% com substatus, 100% com tarefa pendente. **Etapa estreita com tarefa obrigatória funciona.**

### Respostas diretas
- Quantidade de etapas: **ok** (7 no board é o limite do usável). Distribuição de peso: **ruim** — 2 etapas concentram 71% dos leads.
- Funciona em %? Entrada ~90%. Meio de funil ~45%. Leitura gerencial ~60%.
- Harmonia? Não: Novo Lead / Sem Contato / Pós-Visita são precisos; Qualificação / Aquecimento são vagos.
- O que eu mudaria: **nada no Kanban principal — mudaria o que acontece ao clicar na etapa.**

---

## 2. Solução central: subfunil dentro da etapa (sem quebrar nada)

Ao clicar no cabeçalho da etapa, abre um **subfunil Kanban em tela cheia** com os substatus como colunas.

```text
KANBAN PRINCIPAL (inalterado)
Novo Lead │ Sem Contato │ Qualificação │ Nutrição │ Visita │ Pós-Visita │ Em Negociação │ Contrato
                              ▲ clique no cabeçalho
              ┌───────────────┴──────────────────────────────────────────┐
              │  SUBFUNIL — QUALIFICAÇÃO                                 │
              │ Contato   Busca de   Tirando    Contato   Alinhando      │
              │ inicial   imóveis    objeções   quente    visita         │
              │  + coluna "⚠ Sem status" — força a triagem               │
              └──────────────────────────────────────────────────────────┘
```

Arrastar dentro do subfunil **não muda a etapa** — grava só `flag_status`. Zero risco para PDN, relatórios, CAPI, roleta e metas.

---

## 3. Desenho dos sub status

### Regras de ouro
1. **Substatus é "onde o cliente está", não "o que o corretor fez"**.
2. **Máximo 5–6 por etapa.**
3. **Todo substatus precisa ter saída óbvia.**
4. **Substatus não pode significar tempo** — tempo é campo de data. (Erro do Aquecimento 30/60/90 hoje.)

### Qualificação (5 + triagem)
| Substatus | Significa | Saída natural |
|---|---|---|
| Contato inicial | Falou pela 1ª vez, ainda mapeando | Busca de imóveis |
| Busca de imóveis | Perfil claro, buscando/enviando opções | Tirando objeções / Alinhando visita |
| Tirando objeções | Gostou, tem travas (preço, prazo, financiamento) | Contato quente / Nutrição |
| Contato quente | Objeção resolvida, decisão perto | Alinhando visita |
| Alinhando visita | Negociando data/horário | → **etapa Visita** |
| ⚠ Sem status | Não classificado (hoje: 220 leads) | qualquer um acima |

`alinhamento_perfil` → **Contato inicial**; `follow_up` → **Contato quente** (não é estado do cliente, é tarefa).

### Visita (4)
Marcada → Confirmada → Realizada → No-show.
**Confirmada** deve ser preenchida também pela resposta do disparo "visita amanhã" que já existe.
Regra: lead com `status_visita` preenchido **não pode** ficar em Qualificação/Nutrição (hoje há 17 casos fora do lugar).

### Em Negociação (5)
Enviando proposta → Aguardando documentos → Aprovação de proposta (proprietário) → Aprovação bancária → Proposta aprovada → (Contrato).
Única etapa onde o substatus tem **dono externo e prazo**: parado >X dias vira alerta pro gestor, não pro corretor.

---

## 4. Aquecimento → **Nutrição** (desenho completo)

### 4.1 O problema
Aquecimento mistura "quer, mas não agora" (legítimo) com "sumiu no atendimento". Sem saída definida, o corretor larga o lead ali para não descartar, e ninguém volta. 557 leads, 38 dias de média.

### 4.2 Entrada — o corretor responde 2 coisas, não uma
Ao mover para Nutrição abre um diálogo curto (mesmo padrão do modal de próxima ação):

1. **Motivo** (obrigatório, define a cadência)
2. **Data de retomada** (sugerida automaticamente pelo motivo, editável)
3. Observação opcional (vai para o histórico do lead)

| Motivo | Quem é | Cadência sugerida | Retomada padrão |
|---|---|---|---|
| **Financeiro** — juntando entrada / crédito | Quer, falta dinheiro/aprovação | Conteúdo de crédito, entrada, MCMV, simulação — a cada 15 dias | 90 dias |
| **Timing** — vende imóvel, aluguel, mudança | Data conhecida | Toque leve mensal + toque forte perto da data | data informada |
| **Indeciso / comparando** | Está olhando concorrente | Comparativos, prova social, condição — a cada 10 dias | 45 dias |
| **Produto não existe hoje** | Quer algo fora do portfólio | Só avisa quando entrar produto do perfil | 120 dias |
| **Aguardando terceiro** (cônjuge, sócio, família) | Decisão compartilhada | Toque quinzenal leve | 60 dias |

### 4.3 O que acontece com o lead dentro da nutrição
- **Sai da carteira ativa do corretor**: não conta na meta diária, some do Modo Foco, para de gerar tarefa manual. É isso que hoje faz o corretor não usar a etapa direito.
- **Continua sendo dele**: o nome do corretor fica preso ao lead; quem nutre é a U.Home.
- **A cadência roda no motor de reengajamento que já existe** (Central de Reengajamento), com uma trilha por motivo. Nada de motor novo.
- **Fica visível e reversível a qualquer momento** (ver 4.5).

### 4.4 Saída da nutrição — 4 gatilhos
1. **Chegou a data de retomada** → volta pro corretor original com tarefa criada e badge "Voltou da nutrição".
2. **Sinal de vida** (respondeu WhatsApp, clicou, voltou pelo site, novo formulário) → volta na hora, com badge "🔥 Reagiu na nutrição" e tarefa de prioridade alta.
3. **Corretor puxa de volta manualmente** pelo painel de nutrição.
4. **Estourou o prazo máximo (180 dias) sem sinal** → sai do board e vai para Base Única / Oferta Ativa. Não vira descarte silencioso.

Se o corretor não pega o lead retornado em 48h → **Fila do CEO** (mesma regra que já existe hoje).

### 4.5 Como o corretor enxerga e opera a nutrição
- **Botão "🌱 Em nutrição (N)" no header do Pipeline**, ao lado do toggle "🏆 Ganhos" que já existe. Abre um painel dedicado (mesmo padrão de visualização só-leitura + ações).
- Dentro do painel: colunas por motivo, busca por nome/telefone, filtro por data de retomada e ordenação por "mais perto de voltar".
- Cada card mostra: motivo, dias em nutrição, data de retomada, último toque enviado e se houve reação.
- Ações no card: **"Trazer de volta agora"** (escolhe a etapa de destino: Qualificação ou Visita), **"Mudar motivo/data"**, **"Descartar"**.
- **Ninguém fica preso**: o lead nunca some do alcance do corretor, ele só sai da fila de trabalho do dia.

### 4.6 Explicação para o corretor (dentro do produto)
Um card fixo no topo do painel de nutrição, em linguagem direta:

> **O que é a Nutrição?** É onde fica o cliente que quer comprar, mas não agora. Você diz o motivo e quando quer ele de volta — a U.Home cuida do relacionamento nesse meio-tempo (conteúdo por WhatsApp de acordo com o motivo). Ele sai da sua lista do dia, mas continua sendo seu. Quando a data chegar, ou se ele der qualquer sinal de vida, ele volta automático pra sua carteira com uma tarefa criada. Você pode trazer de volta antes da hora quando quiser.

E uma linha de fluxo visual: `Motivo + data → U.Home nutre → sinal ou data → volta pra você com tarefa`.

### 4.7 KPIs da nutrição (não existem hoje)
- Taxa de retorno (quantos voltam e viram visita)
- Tempo médio até retornar
- Motivo que mais converte de volta
- Nutrição por corretor — evita que a etapa vire lixeira de novo

---

## 5. Motivos de descarte padronizados

Hoje `motivo_descarte` é texto livre e caótico: o mesmo motivo em até 6 grafias, 82 registros com `tipo_descarte` nulo, e **duas listas divergentes** no código (`DiscardLeadDialog` e `task-completion/types.ts`).

### Lista canônica única

**Descarte (reengajável — volta para nutrição/oferta ativa)**
| code | Label | Volume histórico |
|---|---|---|
| `nao_atende` | Não atende / não responde | ~790 |
| `sem_retorno` | Sem retorno após tentativas | ~520 |
| `sem_interesse_momento` | Sem interesse no momento | ~235 |
| `sem_condicao_financeira` | Sem condição financeira | ~121 |
| `sem_perfil` | Sem perfil para o produto | ~43 |
| `imovel_nao_atende` | Imóvel não atende a necessidade | — |
| `desistiu_compra` | Desistiu da compra | ~38 |
| `estagnacao` | Descartado por estagnação (automático) | ~65 |
| `outro` | Outro (obriga texto) | — |

**Inativar (definitivo — arquiva)**
| code | Label | Volume histórico |
|---|---|---|
| `nao_quer_contato` | Não quer mais contato | ~212 |
| `contato_invalido` | Contato errado / número inválido | ~198 |
| `lgpd` | Solicitou retirada do nome (LGPD) | ~104 |
| `bloqueou` | Me bloqueou | ~34 |
| `respondeu_nao` | Respondeu NÃO ao reengajamento (automático) | ~164 |
| `lead_antigo` | Lead antigo sem retorno | ~54 |
| `outro` | Outro (obriga texto) | — |

### Como aplicar
- Constante única (`src/lib/discardReasons.ts`) consumida por **todos** os pontos de descarte: `DiscardLeadDialog`, `TaskCompletionDialog`, `FocusModeModal`, `NextActionModal`, `BulkActionModal` e detalhe do lead.
- Grava **o código** além do texto (novo campo `motivo_descarte_code`); `motivo_descarte` continua sendo escrito como hoje — histórico, relatórios e Base Única não mudam.
- Campo livre só em `outro`, obrigatório.
- Motivos automáticos passam a escrever o mesmo código.
- **Nada é reescrito no banco.** Uma camada de normalização na leitura mapeia as ~40 grafias antigas.

---

## 6. Página de Descartes exclusiva do CEO

Nova rota **`/descartes`**, só CEO/admin:
- Ranking por motivo canônico, % do total, corte reengajável × definitivo.
- Recortes por corretor, equipe, empreendimento, origem e período (BRT).
- Cruzamento com **etapa de origem** ("perdemos antes ou depois do contato?").
- Cruzamento com **tempo de vida do lead** (descarte em 2 dias = atendimento; em 90 dias = produto).
- Exportar CSV/PDF e mandar a fatia reengajável para Base Única / Oferta Ativa.

---

## 7. PDN 100% integrado ao novo funil (visão in loco do gestor)

### 7.1 O que está quebrado hoje
O PDN tem "verdade própria": overlay de `oculto`, `caiu`, `grupo_override`, VGV/empreendimento editados na linha e linhas manuais avulsas. Resultado: número do PDN diverge do pipeline e o gestor não confia na planilha.

### 7.2 Regra nova
**O PDN é espelho do pipeline a partir de Pós-Visita.** Dado de negócio (etapa, VGV, empreendimento, corretor, existência da linha) vem só do pipeline. O gestor escreve **inteligência**, não dado.

Escopo do PDN passa a ser exatamente o fim do funil, alinhado ao novo desenho:

```text
Pós-Visita ──► Em Negociação ──► Contrato ──► Ganho
    │              │                │
    └── colunas do PDN do gestor ───┘   (Nutrição e Descarte ficam fora)
```

### 7.3 Tela do gestor
Tela separada (`/pdn`), não mexe no board do corretor:
- **Kanban de fim de funil** com as 4 colunas acima; mover card **move a etapa real do lead** (mesma RPC do Pipeline, com registro no histórico).
- **Painel lateral do negócio**: VGV, empreendimento, corretor, data prevista, substatus da negociação — tudo leitura, com link "Abrir lead".
- **Observação do gestor grava dentro do lead** (linha de histórico com autor + data), não numa tabela paralela. O corretor vê a observação no lead dele.
- Overlay que permanece em `pdn_entries`: observações, próxima ação + data, prioridade, risco manual + motivo, "corretor avisado".
- Overlay que sai: `oculto`, `caiu`, `grupo_override`, VGV/empreendimento editados, linhas manuais.
- **"Marcar como caiu" passa a agir no pipeline** (perda real), não em marcação paralela.
- Card de **Divergências** (negócio sem lead / lead sem negócio) continua, como rede de segurança.

### 7.4 Migração dos dados existentes (item a item, com aprovação)
- 20 `oculto`: apenas ignorados, o negócio volta a aparecer. Nada apagado.
- 33 `caiu`: relatório antes de qualquer ação; gestor decide caso a caso.
- 4 `grupo_override`: relatório etapa PDN × etapa pipeline.
- 25 linhas manuais: relatório com nome/VGV; reais viram negócio no pipeline, resto arquiva.
- Colunas continuam no banco (nada é dropado); o PDN só para de lê-las como verdade.

---

## 8. Aviso e treinamento do corretor (obrigatório antes de ligar as mudanças)

1. **Banner fixo no topo do Pipeline** ("O CRM mudou — veja o que mudou"), dispensável só depois de abrir o guia. Fica visível 14 dias.
2. **Guia passo a passo em 5 telas** (modal), na primeira vez que o corretor entra depois da mudança:
   - O que mudou e por quê (em 1 frase por item)
   - Substatus: como classificar e onde clicar
   - Nutrição: o que é, o que acontece com o lead, como trazer de volta
   - Descarte: a nova lista de motivos e a diferença descarte × inativar
   - "Ficou com dúvida?" — link para a Academia
   - Registro de leitura (quem viu e quando) para o gestor acompanhar a adoção
3. **Tooltips permanentes** nos pontos novos (cabeçalho da etapa, botão de nutrição, campo de motivo).
4. **Aula curta na Academia** com o mesmo conteúdo, para consulta depois.
5. **Checklist do gestor**: lista de quem já leu, para cobrar no 1:1.

---

## 9. Garantias — o que NÃO pode quebrar

Cada fase entra com esta checagem antes de ser considerada pronta:

| Área | Garantia |
|---|---|
| Agenda de visitas | Substatus de Visita continua sendo escrito pelo mesmo caminho (`useVisitas.updateStatus`); nenhuma mudança na criação/sincronia de visitas. A regra "1 visita por cliente por dia" permanece. |
| Central de Tarefas | Nutrição para de gerar tarefa manual, mas não apaga nem cancela tarefa existente; retorno da nutrição usa `createNextTask` que já existe. |
| Relatórios de Performance | `v_fato_venda` / `rpc_metricas` intocados; VGV assinado continua `fase='ganho' + data_assinatura` BRT. Nutrição é rótulo de etapa, não muda contagem de ativos. Relatórios de funil ganham a coluna Nutrição em vez de Aquecimento (mesmo stage_id). |
| PDN | Fase de leitura antes da fase de escrita; relatórios de migração aprovados um a um. |
| CAPI / Meta | Eventos disparam por etapa e não mudam: `Lead` na entrada, `LeadQualificado` em Qualificação, `Schedule` em visita. |
| Roleta / Fila do CEO | Regra `sem_alocado_produto` e distribuição intocadas. Retorno de nutrição não passa por roleta — volta pro corretor original. |
| Histórico | Nenhuma reescrita de `motivo_descarte` nem de `flag_status` antigos; compatibilidade por mapa de leitura. |
| Base Única / Oferta Ativa | Higiene atual (ativos, inativados, descartes 90d) continua; nutrição entra como estado excluído da Oferta Ativa enquanto ativa. |

Toda fase é validada **ao vivo no preview**, etapa por etapa, com lead de teste — nunca só pelo diff.

---

## 10. Ordem de execução (fases pequenas, mockup antes de cada uma)

- **Fase A — Motivos de descarte padronizados.** Menor risco, ganho imediato de dado.
- **Fase B — Subfunil de Qualificação** (5 substatus + "⚠ Sem status"). Valida a mecânica onde dói mais.
- **Fase C — Higiene de substatus** (pedir status ao entrar na etapa) + subfunis de Visita, Em Negociação e Contrato + correção dos leads com visita fora de Visita.
- **Fase D — Aquecimento → Nutrição**: renomear, motivo + data, saída da carteira, painel "🌱 Em nutrição", explicação ao corretor, cadências por motivo, retorno automático, KPIs.
- **Fase E — PDN integrado** (leitura espelho → relatórios de migração → escrita no lead).
- **Fase F — Página `/descartes` do CEO.**
- **Fase G — Aviso + guia + aula na Academia.** Vai junto com a primeira fase visível ao corretor (B) e é atualizado a cada fase.

---

## 11. Notas técnicas

- Fases A–C **não exigem migration de `pipeline_stages`**: subfunil grava só em `pipeline_leads.flag_status` (jsonb), já lido por `leadHelpers.ts` (`QUALIFICACAO_SUBSTATUS`, `AQUECIMENTO_SUBSTATUS`, `VISITA_SUBSTATUS`, `NEGOCIACAO_SUBSTATUS`, `CONTRATO_SUBSTATUS`). Valores antigos ganham mapa de compatibilidade.
- Fase A precisa de **1 migration pequena** (`motivo_descarte_code`, nullable). Resto é frontend.
- Fase D reaproveita o **stage_id do Aquecimento** (só muda label/ícone) — nada de etapa nova, nada de re-mapear leads. Os campos novos (`nutricao_motivo`, `nutricao_retomada_em`) vivem em `flag_status`; só a fila de cadência precisa de tabela/coluna nova.
- Cadência da nutrição usa `nurturing_cadencias` + motor de reengajamento existente; nenhum disparo automático é ligado sem o gate `system_flags.campaign_dispatch_enabled` que já governa envios.
- Fase E segue o plano PDN espelho já aprovado (`usePdn.ts`, `PdnGestor.tsx`, `PdnToolbar.tsx`), com o escopo restrito a Pós-Visita em diante.
- `/descartes` é leitura + normalização em view/RPC; `motivo_descarte` histórico intacto.
- Aviso/guia: componente novo + registro de leitura em tabela simples; sem impacto em nada existente.

---

## 12. Atividade é a verdade · Tarefa é lembrete (fluxo novo, ponta a ponta)

Nada do que está acima muda — este bloco substitui o antigo item 12 e detalha o motor de
atualização e estagnação que passa a sustentar todas as etapas.

### 12.1 Os números que provam o problema

| Métrica (30/90 dias) | Valor |
|---|---|
| Tarefas criadas em 30 dias | 11.496 |
| Tarefas **canceladas** | 2.588 (22,5%) |
| Pendentes / atrasadas | 1.780 / **556** |
| Tarefas por lead (90d) | média 4,6 · **554 leads com 10+** |
| Tarefas/lead por etapa (safra 90d) | Aquecimento **7,1** · **Venda 4,1** |

Quem vendeu teve MENOS tarefas que quem está travado. Volume de tarefa não é progresso.

**O achado mais grave: o "em dia" de hoje é falso.** `ultima_acao_at` é atualizado por qualquer
mexida em tarefa. Comparando com **toque real** (ligação, WhatsApp, visita, proposta, e-mail):

| Etapa | Leads | Dias sem toque (campo atual) | Dias sem toque **real** | >7d | >14d |
|---|---|---|---|---|---|
| Qualificação | 691 | 1 | **15** | 457 | 354 |
| Aquecimento | 557 | 2 | **20** | 437 | 384 |
| Pós-Visita | 75 | 1 | 11 | 42 | 34 |
| Visita | 60 | 2 | 4 | 27 | 22 |
| Em Negociação | 24 | 4 | 12 | 16 | 9 |

**1.417 leads sem contato real há mais de 7 dias aparecem como saudáveis hoje.**

### 12.2 O modelo em uma frase

> **Atividade atualiza. Tarefa lembra. Dias sem atividade cobram.**

Quatro estados — os três primeiros o corretor vê nas pílulas, o quarto **sai da mão dele**:

```text
ATIVIDADE REGISTRADA ──► contador zera ──► volta a EM DIA
     │
0 ─ EM DIA ──► DESATUALIZADO ──► EM ESTAGNAÇÃO ──► ESTAGNADO
   (verde)        (âmbar)        (vermelho, 24h)   (sai do corretor → tela do gestor)
```

- **Em dia** — teve atividade dentro do prazo da etapa.
- **Desatualizado** — passou o 1º prazo; âmbar, sobe no Modo Foco. Não perde nada.
- **Em estagnação** — passou o 2º prazo: **24 horas** para registrar algo, com aviso na tela
  ("Você perde este lead em 24h") + notificação no sino e no resumo diário.
- **Estagnado** — sai da carteira, **some do board do corretor** e cai na tela
  `/leads-estagnados` do gestor, que decide: devolver, repassar, roleta ou descartar
  (RPC `decidir_lead_estagnado`, que já existe).

**O que torna o lead atualizado é uma atividade registrada** — nada mais. Nada de "predisposição":
em tela é sempre "**há X dias sem contato**".


### 12.3 O que conta como atividade

**Zera o contador:** ligação (atendeu ou não), WhatsApp enviado pelo corretor, e-mail/material,
proposta enviada, visita agendada/confirmada/realizada/no-show, reunião, retorno, nota com
conteúdo, resposta do cliente.

**NÃO zera:** criar tarefa, adiar tarefa, cancelar tarefa, editar campo, abrir o lead,
mover de etapa sem registrar.

Tecnicamente: campo novo `ultimo_toque_at` no lead, alimentado só por atividade real.
`ultima_acao_at` continua existindo (não quebra nada) mas deixa de ser fonte de saúde.

### 12.4 Régua de ociosidade — padrão claro por etapa

Uma regra só, aplicada igual em toda etapa, mudando apenas os números:

```text
0 ─── [ dias A ] ─── [ dias B ] ─── +24h ───►
 EM DIA      DESATUALIZADO   EM ESTAGNAÇÃO   ESTAGNADO
 verde           âmbar          vermelho     (sai do corretor)
                                 ▲ aviso + notificação "você perde este lead em 24h"
```

`dias A` = ociosidade para ficar **desatualizado**. `dias B` = ociosidade para entrar **em
estagnação**. `0` em qualquer campo = regra desligada naquela etapa.

**Padrão inicial sugerido (o CEO pode mudar tudo na tela de configuração):**

| Etapa | A · Desatualizado | B · Em estagnação | Estagna (sai do corretor)? |
|---|---|---|---|
| Novo Lead | 1 dia | — | não (vale a regra de aceite/roleta atual) |
| **Sem Contato** | *cadência automática atual, intocada* | — | fim da cadência (regra de banco de hoje) |
| **Qualificação** | **7 dias** | **15 dias** | **sim** — +24h e sai |
| **Aquecimento** | 15 dias (só cor) | 30 dias (só cor) | **não** |
| **Nutrição** | — | — | **não** (contador pausado) |
| **Visita** | 2 dias (só cor) | — | **não** — ciclo curto |
| **Pós-Visita** | 3 dias (só cor) | — | **não** |
| **Em Negociação** | 3 dias (só cor) | — | **não** (alerta vai ao gestor) |
| **Contrato** | 5 dias (só cor) | — | **não** |

Leitura simples para o time: **7 amarelo, 15 vermelho, 16 você perde — e isso só acontece na
Qualificação.** Nas outras etapas a cor existe para priorizar, nunca para punir.

Duas travas de bom senso:
- **Lembrete/visita agendada para o futuro pausa a escalada** (comportamento "protegido" que o
  `EstagnacaoStatusCard` já mostra hoje). Se o compromisso vencer sem atividade, a contagem volta.
- Fim de semana e feriado (`public.feriados`) não contam, como já vale para SLA.

### 12.4b Tela de configuração do CEO

Botão **⚙️ Configurar ociosidade** no header do Pipeline (visível a admin/CEO/gestor conforme
papel) e também em `/configuracoes?secao=pipeline`. Uma tabela editável, uma linha por etapa:

```text
┌ Ociosidade por etapa ─────────────────────────────────────────────┐
│ Etapa            Desatualizado   Em estagnação   Estagna?  Aviso  │
│ Novo Lead            [ 1 ]d          [ 0 ]d        [ ]     24h    │
│ Sem Contato        cadência automática (não editável)             │
│ Qualificação         [ 7 ]d          [15 ]d        [x]     24h    │
│ Aquecimento          [15 ]d          [30 ]d        [ ]      —     │
│ Nutrição           contagem pausada (não editável)                │
│ Visita               [ 2 ]d          [ 0 ]d        [ ]      —     │
│ Pós-Visita           [ 3 ]d          [ 0 ]d        [ ]      —     │
│ Em Negociação        [ 3 ]d          [ 0 ]d        [ ]      —     │
│ Contrato             [ 5 ]d          [ 0 ]d        [ ]      —     │
│                                                                   │
│ Prazo do aviso final: [24] horas   ( ) contar fim de semana       │
│ Pré-visualização: com estes números, hoje 354 leads ficariam      │
│ desatualizados e 12 entrariam em estagnação.                      │
│                        [Restaurar padrão]  [Salvar]               │
└───────────────────────────────────────────────────────────────────┘
```

- Campos aceitam **0 a 365 dias**; `0` desliga aquele nível.
- Validação: `estagnação ≥ desatualizado`; não deixa marcar "Estagna?" com estagnação = 0.
- **Pré-visualização obrigatória** antes de salvar (quantos leads mudam de cor hoje) — evita ligar
  um número que estoura a carteira do time.
- Toda alteração fica registrada (quem mudou, de quanto para quanto) e é exibida no topo da tela.
- Persiste em `pipeline_estagnacao_config` (tabela já existe, hoje com 2 linhas) estendida com as
  colunas de dois níveis + flag de estagnar; nenhuma tabela nova.
- Mudar o número **nunca estagna alguém retroativamente na hora**: quem passar a se enquadrar entra
  primeiro em "em estagnação" e ainda tem as 24h de aviso.


### 12.5 Aquecimento — triagem antes de virar Nutrição

Os 557 leads de Aquecimento hoje:

| Prazo atual | Leads | Sem toque 16-45d | Sem toque >45d |
|---|---|---|---|
| 30 dias | 244 | 144 | 11 |
| (sem prazo) | 224 | 128 | 28 |
| 90 dias | 46 | 34 | 3 |
| 60 dias | 43 | 27 | 2 |
| **Nenhum deles tem visita registrada** | | | |

Ou seja: hoje "Aquecimento" é uma sacola, não uma decisão. Por isso a nutrição **não liga sozinha**:

1. **Aquecimento continua sendo etapa do corretor**, sem estagnação. É o lugar de "quer, mas não agora".
2. No card e no detalhe aparece o botão **"🌱 Enviar para Nutrição"**. Só entra na nutrição o lead
   que o corretor **escolher**, informando motivo + data de retomada (desenho do item 4).
3. **Mutirão de triagem** (uma vez, com o gestor): lista dos 557 em tela dedicada com 3 botões por
   linha — *Enviar para Nutrição* · *Continuar comigo* · *Descartar*. Filtros por prazo e por dias
   sem toque para atacar primeiro os 28 leads sem prazo e sem toque há mais de 45 dias.
4. Quem ficar como "continuar comigo" e passar de **60 dias sem atividade** vira apenas um alerta
   ao gestor no relatório de higiene — **não estagna, não sai do corretor**.
5. Só depois da triagem as cadências por motivo são ligadas (com o gate
   `system_flags.campaign_dispatch_enabled` que já governa envios).

### 12.6 Como funciona na prática, do começo ao fim

**a) Entrada e Sem Contato** — inalterado: roleta/Fila do CEO → aceite → cadência automática de
tarefas. No primeiro contato atendido o lead vai para Qualificação e **sai do regime de tarefa obrigatória**.

**b) Ao mover para Qualificação (e em qualquer atualização depois), abre o Registrar atividade:**

```text
┌── Registrar atividade ───────────────────────┐
│  O que aconteceu?                            │
│  [📞 Falei]  [📵 Não atendeu]  [💬 WhatsApp] │
│  [🏠 Marquei visita] [📄 Proposta] [📝 Nota] │
│                                              │
│  Situação: (substatus da etapa) ▾            │
│  Observação (opcional) .................     │
│                                              │
│  Quer criar um lembrete?                     │
│   ( ) Não precisa   (•) Sim → [data] [hora]  │
│                                              │
│              [Registrar]                     │
└──────────────────────────────────────────────┘
```

- Registrar → grava atividade, atualiza substatus, **zera o contador** e fecha automaticamente a
  tarefa pendente compatível (sem diálogo extra).
- Lembrete é **opcional**. Sem lembrete, o lead simplesmente entra na régua de dias.
- O mesmo diálogo abre pelo botão fixo "Registrar atividade" no detalhe do lead e pela barra
  rápida do card (evolução do `QuickActionMenu` que já existe).

**c) O ciclo:** registrou → verde → 15 dias sem nada → âmbar → aviso de 24h → vermelho →
sai para o gestor. Registrou em qualquer ponto: volta a verde, contador zera.

**d) Tarefa, no modelo novo:** é lembrete pessoal, aparece na agenda, notifica, **nunca bloqueia**
e **nunca é obrigatória para atualizar** (fim do `NextActionModal` obrigatório). Continua
automática só onde é regra de negócio: Sem Contato, fluxo de Visita (1 card por vez), retorno de
nutrição e prazo externo estourado em Negociação.

### 12.7 Ordem de visualização dos leads

Padrão sugerido: **"Precisa de mim"** — escada lida em 1 segundo:

```text
1º  Em estagnação (24h para agir) ..... menos tempo restante primeiro
2º  Atrasado ......................... mais dias sem contato primeiro
3º  Compromisso de hoje .............. lembrete ou visita marcada hoje
4º  Em dia ........................... mais recente primeiro
```

Recente puro faz o corretor trabalhar sempre nos mesmos leads — a escada resolve o esquecimento e
mantém o recente no topo *dentro* do verde. Seletor com **Precisa de mim** (padrão) ·
**Mais recente** · **Mais antigo sem contato** · **Termômetro** · **Valor**, salvo por corretor
(estende `pipelineSortOrder.ts`, que já existe).

### 12.8 Pílulas, filtros e Modo Foco

As pílulas do header do Pipeline hoje são `em dia · sem tarefa · atrasado` (e a informacional
Negócios). "Sem tarefa" morre — no modelo novo tarefa não é obrigatória. Ficam **3 pílulas de
saúde**, exatamente na linguagem do corretor:

```text
● Em dia (n)      ● Desatualizado (n)      ● Em estagnação (n)
   verde                 âmbar                    vermelho
```

Regras das pílulas:
- Somam sempre 100% da carteira visível — todo lead está em uma das três.
- Clicar filtra o board (mesma mecânica de `?filtro=` que já existe).
- **Estagnado não vira pílula do corretor** — o lead já saiu do board dele.
- Um 4º chip opcional, informacional e separado das três: **📅 Compromisso hoje (n)**
  (lembrete ou visita marcada para hoje). Fica visualmente destacado para não parecer saúde.
- Gestor/CEO veem as mesmas três + **Estagnados (n)**, que abre `/leads-estagnados`.

Mais o filtro numérico **"sem contato há mais de ___ dias"** (3 / 7 / 15 / 30 / 60), disponível
para corretor, gestor e CEO, e exportável.

**Modo Foco** (hoje 100% tarefa) passa a ser:

| Fila | Regra |
|---|---|
| 🔴 Em estagnação | 24h para não perder o lead |
| 🟠 Desatualizados | passou o prazo da etapa |
| 🏠 Visita sem desfecho | visita realizada sem atividade depois (mantida) |
| 📅 Compromissos de hoje | lembretes e visitas do dia |

Cada card abre direto no Registrar atividade — 2 cliques por lead. Fechamento:
"Você atualizou 12 leads hoje. 4 continuam sem contato há mais de 15 dias."


### 12.9 Cobrança e engajamento (referências de mercado)

- **Salesforce / HubSpot — "days since last activity"**: campo nativo e filtrável. Lição: só vale
  se medir atividade real, não edição de registro. É o nosso `ultimo_toque_at`.
- **Pipedrive — "rotten deals"**: negócio apodrece após X dias **por etapa**, configurável.
  Lição: régua por etapa (item 12.4), não número único.
- **Pipedrive / Close — activity-based selling**: a meta do time é atividade/dia, não tarefa
  concluída. Lição: trocar a meta do corretor.
- **Close / Outreach — one-click logging**: registrar é 1 clique e o próximo passo é opcional.
- **Erro clássico documentado**: obrigar próxima tarefa gera "tarefa fantasma" — os nossos
  **2.588 cancelamentos em 30 dias** são exatamente isso.

Na prática aqui: meta por **atividades/dia e leads tocados/dia**; placar diário simples
("leads tocados hoje: 8 · carteira em dia: 74%"); **1 resumo por dia** ao corretor (não alerta por
lead); ao gestor só chega estagnado; "% da carteira em dia" vira KPI de 1:1 e do dashboard v4.

### 12.10 Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Corretor para de agendar e esquece o lead | O contador cobra sozinho + Modo Foco + aviso de 24h antes de perder |
| Corretor perde lead bom por descuido | Aviso de 24h com notificação; gestor pode devolver com 1 clique |
| Gestor perde régua de cobrança | Régua passa a ser atividades/dia + % de carteira em dia (dado mais honesto) |
| Relatórios de tarefa quebram | `pipeline_tarefas` intacta; Central de Tarefas segue funcionando |
| Aquecimento vira lixeira de novo | Triagem obrigatória + relatório de higiene >60 dias ao gestor |

### 12.11 Impacto no resto do CRM

| Área | Efeito |
|---|---|
| Sem Contato | intocado (cadência de banco) |
| Central de Tarefas / Agenda | seguem; tarefa vira lembrete |
| Motor de estagnação | passa a usar `ultimo_toque_at` + régua da 12.4; só Qualificação remove lead |
| Dashboard gestor v4 / CEO | "carteira em dia" substitui "sem tarefa" |
| PDN | inalterado (item 7) |
| Nutrição / Reengajamento | resposta do lead conta como atividade |
| Relatórios / CAPI / Visitas | inalterados |

### 12.12 Fases da Fase H (entra depois da Fase D)

- **H1 — Verdade do contador**: `ultimo_toque_at` + backfill + função de dias sem contato.
  Nada muda em tela; permite comparar número novo × atual antes de trocar.
- **H2 — Registrar atividade**: diálogo único, lembrete opcional, fechamento automático de tarefa
  compatível. Primeiro em Qualificação.
- **H3 — Saúde visual**: cores/labels no card, as 3 pílulas novas (Em dia · Desatualizado ·
  Em estagnação), filtro "sem contato há X dias", nova ordenação.
- **H4 — Modo Foco** por dias sem contato.
- **H5 — Configuração do CEO** (tela ⚙️ da 12.4b, com pré-visualização) **+ estagnação nova**:
  Qualificação 7/15 + 24h, saída para a tela do gestor, resumo diário.

- **H6 — Triagem do Aquecimento** (mutirão dos 557) e só então ligar cadências.
- **H7 — Metas e placar** de atividade; aposentar o `NextActionModal` obrigatório.

---

## 13. Qualificação visual dos fluxos

- **Cabeçalho de etapa clicável**: hoje não há affordance. Adicionar seta discreta + contagem de "⚠ sem status", para o clique ser óbvio.
- **Subfunil**: colunas mais estreitas que o Kanban principal, fundo levemente rebaixado e breadcrumb "Pipeline › Qualificação", para o corretor nunca achar que trocou de sistema.
- **Card do lead**: hierarquia atual é plana. Nome forte, substatus como chip discreto, e um único sinal de urgência à esquerda (barra colorida) em vez de vários badges concorrendo.
- **Temperatura de tempo**: borda esquerda neutra (0-3 dias) → âmbar (4-14) → vermelha (>14). Um só idioma visual de "está parado", usado igual no Kanban, no subfunil e no PDN.
- **Nutrição**: identidade própria (verde/planta), cards mais baixos e sem sinal de urgência — é etapa de espera, não pode parecer atraso.
- **PDN**: as 4 colunas com faixa de VGV no topo de cada uma, para o gestor ler dinheiro antes de ler quantidade.
- **Barra de ação rápida**: botões grandes, ícone + verbo no passado ("Falei", "Não atendeu"), fixa no rodapé do detalhe do lead no mobile — hoje a ação principal fica escondida em menu.
- **Estados vazios**: usar o `StateWrapper` que já existe em todas as telas novas, para erro nunca virar zero silencioso.

---

## 14. Validação ponta a ponta (obrigatória em cada fase)

Roteiro fixo, executado ao vivo no preview com lead de teste, antes de qualquer fase ser dada como pronta:

1. **Entrada**: lead novo pelo Meta → roleta/Fila do CEO → aceite → substatus inicial.
2. **Qualificação**: mover no subfunil → confere `flag_status`, histórico e que a etapa não mudou.
3. **Nutrição**: entrar com motivo/data → sai da carteira → aparece no painel → volta por data e por sinal → tarefa criada no retorno.
4. **Visita**: agendar → confirmar → realizar/no-show → conferir agenda, regra 1 por cliente/dia e evento `Schedule`.
5. **Pós-Visita → Negociação → Contrato → Ganho**: conferir espelho no PDN e observação do gestor aparecendo no lead.
6. **Descarte/Inativar**: novo motivo grava código + texto; lead sai do board; aparece em `/descartes`.
7. **Relatórios**: Performance, Dashboard do gestor v4, CEO e PDN batendo antes e depois (print do antes obrigatório).
8. **Central de Tarefas e Agenda de Visitas**: contagens iguais às do dia anterior, fora o efeito esperado.
9. **Mobile**: o corretor trabalha no celular — cada fase é validada em 440px também.
10. **Rollback**: cada fase tem o caminho de volta escrito antes de subir.

---

## 15. Sugestões extras (para você decidir)

- **Selo "Predisposição"** no card (sinal recente + etapa + tempo) — alimenta o Modo Foco e o ranking do dia.
- **Meta de atividades/dia por corretor**, substituindo meta de tarefas concluídas.
- **Alerta de lead parado por etapa** com prazo diferente por etapa (Qualificação 7d, Visita 3d, Negociação 5d), indo para o gestor e não para o corretor.
- **Motivo de descarte obrigatório também na saída da nutrição** — para saber por que a nutrição não converteu.
- **Relatório mensal "onde perdemos"**: descarte por etapa de origem × motivo × empreendimento, direto para o 1:1.
