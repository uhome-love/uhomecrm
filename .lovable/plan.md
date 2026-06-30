# Validação das etapas de estagnação

## O que encontrei (auditoria)

Conferi o motor de estagnação de ponta a ponta para as 3 etapas que você citou. A boa notícia: a **lógica já está correta** — falta só ajustar **um** prazo e corrigir **1 lead**.

### Prazos atuais (tabela `pipeline_estagnacao_config`)
| Etapa | Hoje | Você quer | Ação |
|---|---|---|---|
| Contato Iniciado | **7 dias** | 15 dias | **Alterar para 15** |
| Busca | 15 dias | 15 dias | Já correto ✅ |
| Aquecimento | 30 dias | 30 dias | Já correto ✅ |

### Como a regra "sem tarefa" e "tarefa atrasada" já funciona
O motor calcula um único "relógio de inatividade" (`_pipeline_referencia_estagnacao`) que pega **o mais recente** entre:
- a **última ação humana** (entrada na etapa, ligação, WhatsApp enviado, visita, tarefa concluída, anotação); e
- o **vencimento de uma tarefa atrasada**.

Resultado prático, que bate 100% com o que você pediu:
- **Sem tarefa criada** → conta a partir da última ação / entrada na etapa. Passou de X dias → estagna.
- **Com tarefa atrasada** → conta a partir do vencimento da tarefa. Atrasou X dias → estagna.
- **Qualquer ação ou tarefa futura pendente zera o relógio** e protege o lead.

Depois do estouro do prazo, há **aviso ao corretor (48h)** antes de arquivar de fato.

### Auditoria dos estagnados de hoje (1 por 1)
Nessas 3 etapas só há **1 lead estagnado hoje**: **Alexandre Nogueira** (Contato Iniciado).
**Está incorretamente estagnado** (falso-positivo): ele teve **WhatsApp hoje 17:03** e tem **tarefa pendente futura (vence 07/07)** criada às 18:20 — ou seja, está sendo trabalhado. Dias reais parado = **0**. Será desarquivado.

### Dashboard do corretor (futuras estagnações)
O card **"Leads prestes a estagnar"** (`PreEstagnacaoCard`, montado no `CorretorDashboard`) lê o prazo **dinamicamente** da config e mostra leads a partir de `dias_limite − 2`. Então, ao mudar Contato Iniciado para 15, ele passa a avisar automaticamente a partir do 13º dia (Busca: 13º, Aquecimento: 28º). **Nenhuma mudança de código necessária** — só confirmar visualmente após o ajuste.

## Plano de execução

1. **Migration** — atualizar `pipeline_estagnacao_config`: Contato Iniciado `dias_limite = 15` (Busca e Aquecimento permanecem). Mantém `ativo`, `limite_backfill_dia`.
2. **Correção de dados** — recalcular os estagnados das 3 etapas pelo relógio real: desarquivar/limpar (`estagnado`, `estagnado_em`, `estagnado_aviso_em`, `estagnado_prazo_em`, `arquivado`) de todo lead cujo relógio de inatividade já não atinge o novo limite — corrige o Alexandre e qualquer outro falso-positivo.
3. **Reprocessar** — rodar `processar_estagnacao_pipeline()` uma vez para reavaliar tudo sob a regra nova.
4. **Validar 1 por 1** — após rodar, conferir no banco que:
   - Contato Iniciado/Busca só estagnam com ≥15 dias reais; Aquecimento com ≥30;
   - leads com tarefa futura ou ação recente não aparecem como estagnados;
   - o `PreEstagnacaoCard` lista as futuras estagnações nos novos limiares.
5. **Texto para o time** — entregar o resumo simples abaixo.

## Texto para explicar ao time (rascunho final entregue após execução)

> **Quando um lead "estagna" (e some do pipeline)?**
> O sistema conta os dias **sem nenhuma ação sua** (ligação, WhatsApp, visita, tarefa concluída) **ou** com **tarefa atrasada**:
> - **Contato Iniciado:** 15 dias
> - **Busca:** 15 dias
> - **Aquecimento:** 30 dias
>
> Funciona assim: se você **não criou tarefa**, conta desde a última ação; se **criou e deixou atrasar**, conta desde o vencimento. **Qualquer ação ou tarefa agendada para o futuro zera o contador.** Antes de arquivar, você recebe um **aviso de 48h**. No card "Leads prestes a estagnar" do seu painel você já vê quem está chegando perto.

## Detalhes técnicos
- Sem alteração de funções/triggers; apenas dados (`UPDATE` na config + correção de leads) e uma chamada de reprocessamento.
- Janela de aviso do dashboard = `dias_limite − 2` (dinâmica). Se quiser uma antecedência maior no Aquecimento (ex.: avisar 5 dias antes em vez de 2), posso parametrizar — me avise.
- Etapa "Sem Contato" tem motor próprio (cadência 7 tentativas) e não é afetada por este ajuste.
