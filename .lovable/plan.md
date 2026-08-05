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
