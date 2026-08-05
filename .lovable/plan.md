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

- **Trava 1 — Qualificação é depósito.** 691 leads, 56% parados >14 dias, e **220 (30%) sem nenhum substatus**. Cinco realidades diferentes escondidas atrás de um nome só.
- **Trava 2 — Aquecimento é cemitério.** 557 leads, 63% parados >14 dias, 38 dias de média, 103 sem prazo definido. E há leads com visita marcada/realizada parados lá dentro.
- **Trava 3 — Visita furada.** Só 60 em Visita enquanto marcada/realizada aparece dentro de Aquecimento e Qualificação (`alinhando_visita`, 25 leads).

**O que já está bom:** Novo Lead e Sem Contato (0,5 e 4,7 dias). E Pós-Visita: 0 parados >14 dias, 100% com substatus, 100% com tarefa pendente — a etapa mais nova e mais estreita é a mais bem operada. Isso prova a tese: **etapa estreita com tarefa obrigatória funciona.**

**Disciplina do time é alta** (5.084 follow-ups concluídos em 60 dias; só 23 leads em Qualificação sem tarefa). O problema é o mapa, não o operador.

### Respostas diretas
- Quantidade de etapas: **ok** (7 no board é o limite do usável). Distribuição de peso: **ruim** — 2 etapas concentram 71% dos leads.
- Funciona em %? Entrada ~90%. Meio de funil ~45%. Leitura gerencial ~60% (30% dos cards sem substatus).
- Harmonia? Não: Novo Lead / Sem Contato / Pós-Visita são precisos; Qualificação / Aquecimento são vagos.
- O que eu mudaria: **nada no Kanban principal — mudaria o que acontece ao clicar na etapa.**

---

## 2. Solução central: subfunil dentro da etapa (sem quebrar nada)

Não adicionar colunas ao board (10+ colunas é ilegível no notebook e impossível no celular). Ao clicar no cabeçalho da etapa, abre um **subfunil Kanban em tela cheia** com os substatus como colunas.

```text
KANBAN PRINCIPAL (inalterado)
Novo Lead │ Sem Contato │ Qualificação │ Nutrição │ Visita │ Em Negociação │ Contrato
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

## 3. Desenho dos sub status (versão aprovada + dicas)

### Regras de ouro que usei no desenho
1. **Substatus é "onde o cliente está", não "o que o corretor fez"** — o que o corretor fez já vive em tarefas/atividades. Se o nome for um verbo do corretor, ele desatualiza sozinho.
2. **Máximo 5–6 por etapa.** Acima disso o corretor para de escolher e deixa vazio (é o que acontece hoje).
3. **Todo substatus precisa ter uma saída óbvia** — se não dá pra dizer "daqui ele vai pra X", ele é um depósito.
4. **Um substatus não pode significar tempo.** Tempo é campo de data, não coluna. (Erro do Aquecimento 30/60/90 hoje.)

### Qualificação (5 + triagem)
| Substatus | Significa | Saída natural |
|---|---|---|
| Contato inicial | Falou pela 1ª vez, ainda mapeando | Busca de imóveis |
| Busca de imóveis | Perfil claro, buscando/enviando opções | Tirando objeções / Alinhando visita |
| Tirando objeções | Gostou, tem travas (preço, prazo, financiamento) | Contato quente / Nutrição |
| Contato quente | Objeção resolvida, decisão perto | Alinhando visita |
| Alinhando visita | Negociando data/horário | → **etapa Visita** |
| ⚠ Sem status | Não classificado (hoje: 220 leads) | qualquer um acima |

*Dica:* "Alinhamento de perfil" e "Follow-up" atuais somem — o primeiro vira **Contato inicial**, o segundo não é estado do cliente, é tarefa. Isso já libera 180 leads mal rotulados.

### Visita (4)
Marcada → Confirmada → Realizada → No-show.
*Dica:* **Confirmada** é o substatus que mais protege receita — é ele que permite medir no-show real. Ele deve ser preenchido automaticamente pela resposta do disparo "visita amanhã" que já existe, não só na mão.
*Regra:* lead com `status_visita` preenchido **não pode** ficar em Qualificação/Nutrição — vai para Visita (hoje há 17 casos fora do lugar).

### Em Negociação (5)
Enviando proposta → Aguardando documentos → Aprovação de proposta (proprietário) → Aprovação bancária → Proposta aprovada → (Contrato).
*Dica:* essa etapa é a única onde o substatus deve ter **dono e prazo**: cada um desses estados tem um responsável fora do corretor (cliente, proprietário, banco). Substatus parado >X dias aqui vira alerta pro gestor, não pro corretor.

### Nutrição (nova cara do Aquecimento — ver seção 4)
Prazo virou **campo de data de retomada**, não coluna. Colunas passam a ser motivo:
Financeiro (juntando entrada / crédito) · Timing (vende imóvel, aluguel, mudança) · Indeciso / comparando · Produto não existe hoje.

### Sobre a triagem "⚠ Sem status"
É o maior ganho imediato: hoje ela nasceria com 220 leads em Qualificação e 103 em Aquecimento. Primeira vez que o gestor vê num lugar só tudo que está sem endereço.
Complemento: ao **mover o card para** Qualificação, Nutrição, Visita ou Em Negociação, o CRM pede o substatus com 1 clique (usando o modal de próxima ação que já existe). Mata o problema na origem.

---

## 4. Aquecimento → **Nutrição** (o cemitério vira ativo)

Diagnóstico: Aquecimento hoje mistura dois públicos opostos — "quer, mas não agora" (legítimo) e "sumiu no meio do atendimento" (deveria estar em recuperação/descarte). Como não há saída definida, o corretor larga o lead ali para não descartar, e ninguém volta.

Proposta de desenho:

1. **Renomear para Nutrição** e mudar a pergunta na entrada: em vez de "quantos dias?", "**por que ele não avança agora?**" (Financeiro / Timing / Indeciso / Produto) **+ data de retomada** obrigatória.
2. **O lead sai da carteira ativa do corretor, mas não é descartado.** Ele deixa de contar na meta diária, some do "Modo Foco" e para de gerar tarefa manual — que é exatamente o que faz o corretor não usar a etapa direito hoje.
3. **A U.Home nutre, não o corretor.** Nutrição por motivo, reaproveitando o motor de reengajamento que já existe: conteúdo de crédito/entrada para Financeiro, novidades de lançamento para Produto, comparativos para Indeciso.
4. **Retomada automática:** chegou a data, ou o lead respondeu / clicou / voltou pelo site → volta para o corretor **original** com tarefa criada e badge "Voltou da nutrição". Se o corretor não pega em 48h, cai na Fila do CEO.
5. **Prazo máximo de nutrição** (sugiro 180 dias). Estourou sem sinal nenhum → vai para Base Única / Oferta Ativa em vez de apodrecer no board.
6. **KPI próprio:** taxa de retorno da nutrição. Hoje esse número não existe — é por isso que 557 leads podem ficar 38 dias parados sem ninguém notar.

Efeito prático: o board do corretor deixa de mostrar 557 cards que ele não vai tocar, e a empresa passa a ter uma base morna trabalhada por máquina.

---

## 5. Motivos de descarte padronizados

Hoje `motivo_descarte` é texto livre e está caótico: "Descartado: Não atende / não responde" (498), "Descarte: Não atende / não responde" (188 + 48 + 37 em variações de grafia), "Descarte: nao atende | Empreendimento: Casa Tua" (67)… o mesmo motivo em 6 grafias, e 82 registros com `tipo_descarte` nulo. Além disso, hoje existem **duas listas diferentes** de motivos no sistema (`DiscardLeadDialog` e `task-completion/types.ts`) que não batem entre si.

### Lista canônica única (extraída do que o time realmente usa)

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
- Uma constante única (`src/lib/discardReasons.ts`) consumida por **todos** os pontos de descarte: `DiscardLeadDialog`, `TaskCompletionDialog`, `FocusModeModal`, `NextActionModal`, `BulkActionModal` e o detalhe do lead. Fim das listas divergentes.
- Passa a gravar **o código** além do texto (novo campo `motivo_descarte_code`), mantendo `motivo_descarte` como hoje para não quebrar histórico, relatórios nem a Base Única.
- Campo livre só quando `outro`, e obrigatório.
- Os motivos automáticos (estagnação, reengajamento NÃO) escrevem o mesmo código — hoje escrevem texto solto.
- **Histórico:** nada é reescrito no banco. Uma camada de normalização na leitura mapeia as ~40 grafias antigas para os códigos acima, para os relatórios já nascerem limpos.

---

## 6. Página de Descartes exclusiva do CEO

Nova rota **`/descartes`**, visível só para CEO/admin:
- Ranking por motivo canônico, com % do total e corte **reengajável × definitivo**.
- Recortes por corretor, equipe, empreendimento, origem e período (BRT).
- Cruzamento com **a etapa de onde o lead saiu** — responde "perdemos antes ou depois do contato?".
- Cruzamento com **tempo de vida do lead** — descarte em 2 dias é problema de atendimento; em 90 dias é problema de produto.
- Exportar CSV/PDF e mandar a fatia reengajável direto para Base Única / campanha de Oferta Ativa (fluxo já existente).

---

## 7. Ordem de execução (fases pequenas, mockup antes de cada uma)

- **Fase A — Motivos de descarte padronizados.** Menor risco, ganho imediato de dado. (constante única + código gravado + normalização na leitura)
- **Fase B — Subfunil de Qualificação** com os 5 substatus novos + coluna "⚠ Sem status". Valida a mecânica onde dói mais (691 leads).
- **Fase C — Higiene de substatus** (pedir status ao entrar na etapa) + subfunis de Visita, Em Negociação e Contrato + correção dos leads com visita presos fora de Visita.
- **Fase D — Aquecimento → Nutrição**: renomear, motivo + data de retomada, saída da carteira ativa, retorno automático e KPI de retorno.
- **Fase E — Página `/descartes` do CEO.**

---

## 8. Notas técnicas

- Fases A–C **não exigem migration de `pipeline_stages`**: subfunil grava só em `pipeline_leads.flag_status` (jsonb), já em produção e já lido por `leadHelpers.ts` (`QUALIFICACAO_SUBSTATUS`, `AQUECIMENTO_SUBSTATUS`, `VISITA_SUBSTATUS`, `NEGOCIACAO_SUBSTATUS`, `CONTRATO_SUBSTATUS`). Os novos valores entram lá; os valores antigos ganham mapa de compatibilidade (`alinhamento_perfil` → `contato_inicial`, `follow_up` → `contato_quente`) para nenhum card ficar órfão.
- Fase A precisa de **1 migration pequena** (coluna `motivo_descarte_code`, nullable) — o restante é frontend.
- Fase D é a única com impacto em automação (nutrição, metas, Modo Foco, Fila do CEO) e deve ter plano próprio antes do build.
- O subfunil é componente novo (drawer full-screen) reusando o card atual; o board principal não é tocado.
- `/descartes` é leitura + normalização em view/RPC; `motivo_descarte` histórico permanece intacto para auditoria.
