# Respostas do formulário do Meta no lead

## Problema

Os formulários dos anúncios agora têm perguntas de qualificação — **cada empreendimento tem a sua própria pergunta** (a de tipologia "Qual a sua preferência? Studio / 1 Dormitório / Ambos" é só um exemplo; outros formulários perguntam outra coisa, e o Terrace ainda não foi atualizado). O CRM, porém, só aproveita nome, e-mail e telefone do `field_data`. Verificado no receptor de leads do Meta: as demais perguntas são lidas e descartadas, e não existe nenhuma coluna no lead guardando essas respostas (nenhum campo de payload bruto em `pipeline_leads`; `jetimob_processed` só guarda id + telefone). Resultado: o corretor abre o lead e não vê o que a pessoa respondeu.

A solução é genérica: guarda e exibe **qualquer** pergunta/resposta que o formulário daquele empreendimento trouxer, sem lista fixa de perguntas no código.

## O que muda

### 1. Guardar as respostas na entrada do lead

Nova coluna `form_respostas` (JSON) em `pipeline_leads`, gravada pelos receptores no formato:

```text
[{ "pergunta": "Qual a sua preferência?", "resposta": "1 Dormitório" }, ...]
```

Regras de captura:
- Todos os campos do formulário que não sejam nome/e-mail/telefone entram na lista, na ordem em que o Meta envia.
- O rótulo mostrado é a pergunta real quando o Meta manda (`label`/`question`); senão usa o nome técnico do campo formatado de forma legível.
- Vale para os três formatos aceitos hoje: webhook nativo do Meta (`field_data`), Make.com (`mappable_field_data`) e a rede de segurança `meta-leads-backfill` (que já busca `field_data` na Graph API).
- Se o lead já existe e volta com novo interesse, as respostas novas substituem as antigas e o texto vai também para o histórico de observações, preservando o registro anterior.

### 2. Mostrar para o corretor no modal do lead

O corretor precisa bater o olho e entender na hora. Três pontos, todos no detalhe do lead:

- **Bloco em destaque "Respostas do formulário"**, logo abaixo do cabeçalho do lead (acima de observações), sem precisar clicar em aba: card com borda de destaque, título com ícone, e uma linha por pergunta — pergunta em texto secundário menor e **resposta em negrito**, tamanho maior. Suporta N perguntas do formulário daquele empreendimento (qualquer quantidade), e mostra o nome do formulário/empreendimento de origem no topo do card.
- **Selo no topo do lead** quando houver respostas, para chamar atenção mesmo com o card recolhido em telas menores.
- **Evento na linha do tempo** (aba Histórico), na data de entrada: "Respondeu no formulário — <pergunta>: <resposta>", uma linha por resposta, junto dos demais eventos de origem.

Leads sem respostas (Terrace, formulários antigos) seguem exatamente como hoje, sem bloco vazio nem selo.

### 3. Leads já recebidos

Os leads que entraram desde a atualização dos formulários podem ter as respostas recuperadas rodando o backfill do Meta em modo leitura (a Graph API devolve o `field_data` completo por lead). Aplicar aos leads dos últimos 7 dias que tenham `meta_lead_id` e ainda não tenham respostas.

## Detalhes técnicos

- Migration: `ALTER TABLE public.pipeline_leads ADD COLUMN form_respostas jsonb` (sem mudança de RLS/grants — tabela já exposta).
- Extração compartilhada em `supabase/functions/_shared/` (`parseFormRespostas`) usada por `receive-meta-lead`, `receive-landing-lead` e `meta-leads-backfill`, para não duplicar lógica.
- Gravação envolvida em try/catch: nunca pode derrubar a criação do lead (regra de rastreamento vigente).
- Frontend: novo componente `LeadFormRespostas.tsx` em `src/components/pipeline/drawer/`, consumido por `PipelineLeadDetail.tsx`; evento derivado em `LeadHistoricoTab.tsx` junto dos eventos existentes.
- Sem impacto na roleta, distribuição ou CAPI.

## Validação

- Enviar um payload sintético com pergunta de múltipla escolha e conferir a coluna preenchida.
- Abrir um lead real recente no preview e ver o bloco e o evento na linha do tempo.
- Conferir que um lead do Terrace (formulário sem perguntas) continua idêntico.
