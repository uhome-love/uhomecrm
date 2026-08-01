# Oferta Ativa — só base limpa + aviso de lista personalizada para o corretor

## O que está errado hoje (verificado no banco)

A criação de campanha filtra a Base Única, mas **não bloqueia** quem já está no pipeline:

- A prévia (`preview_campanha_da_base_v2`) não exclui nada além de opt-out/produto extinto — nem quem já está na Oferta Ativa.
- A criação (`criar_campanha_da_base_v2`) só exclui quem já está numa fila de Oferta Ativa. Pipeline ativo e descartados **passam**.
- O único freio é o campo `situacao_crm` da base, que é uma **foto do momento da importação** e não é recalculado por nenhuma função/trigger — ele envelhece conforme leads entram no pipeline.

Tamanho do problema hoje na base de 37 mil:

```text
Base com correspondência no pipeline ...... 6.483 leads
  · ativos no pipeline ..................... 960
  · em descarte / caiu ................... 4.914   (território do Mutirão de sexta)
Marcados "inéditos" na base ............... 18.645
```

## Regra que passa a valer

A Oferta Ativa é **reengajamento de base fria**. Entram só leads que:

1. têm telefone (ou e-mail, conforme o filtro),
2. **não existem no pipeline** — nem ativos, nem descartados/caídos, nem arquivados,
3. não estão numa fila de Oferta Ativa em andamento (na fila, cooldown ou aproveitado),
4. não estão em opt-out e o produto não está extinto.

Descartados continuam reservados ao Mutirão ao vivo de sexta. Essa regra é aplicada **sempre**, não é um checkbox que alguém pode desmarcar.

Efeito prático: o filtro "Situação no CRM" (Todos / Inéditos / Já na Oferta Ativa / Já no pipeline) some do assistente — a base elegível já é, por definição, "inédita". No lugar dele fica uma linha de transparência: "3.444 no filtro · 210 removidos por já estarem no CRM · 300 serão liberados".

## Fases

### Fase 0 — Mockup
Duas telas em HTML para aprovação antes de qualquer código:
1. Passo "Público" do assistente sem o filtro de situação, com o resumo de higiene ("X no filtro · Y removidos por já estarem no CRM · Z liberados").
2. Aviso no dashboard do corretor (card de lista personalizada).

### Fase 1 — Higiene na fonte (banco)
Uma migração ajustando as duas funções da campanha:

- `preview_campanha_da_base_v2` e `criar_campanha_da_base_v2` passam a excluir, por telefone (8 dígitos) e por e-mail:
  - qualquer correspondência em `pipeline_leads` (qualquer etapa, incluindo descarte/caiu e arquivados),
  - correspondência ativa em `oferta_ativa_leads` (na fila / cooldown / aproveitado).
- O parâmetro `situacao` do filtro passa a ser ignorado (mantido no JSON por compatibilidade, sem efeito).
- O preview passa a devolver também `removidos_crm` e `removidos_oa`, para mostrar a higiene na tela.
- Função `atualizar_situacao_crm_base_leads()` recalculando `situacao_crm` a partir do estado real do pipeline/OA, agendada 1x/dia, para que os painéis da Base Única parem de envelhecer.

### Fase 2 — Assistente de campanha (frontend)
- Remover o bloco "Situação no CRM" do passo Público.
- Rodapé e card de resumo passam a mostrar a contagem de higiene ("removidos por já estarem no CRM").
- Texto de apoio explicando a regra em uma linha.

### Fase 3 — Aviso de lista personalizada no dashboard do corretor
Card novo acima da saudação, no padrão do banner do Mutirão, visível só quando existe campanha liberada para aquele corretor (respeitando o escopo equipe/corretor):

```text
┌──────────────────────────────────────────────────────────────┐
│ 📞  VOCÊ TEM UMA LISTA DE OFERTA ATIVA                        │
│                                                              │
│ Casa Tua · "Reativar safra 2024"                             │
│ 300 leads na sua fila  ·  ⏳ expira em 3 dias                 │
│ [███████░░░░░░░░]  92 de 300 já trabalhados                  │
│                                                              │
│                            [ Começar a ligar → ]             │
└──────────────────────────────────────────────────────────────┘
```

Comportamento:
- Contagem regressiva ao vivo (dias/horas) e destaque em vermelho no último dia — a sensação de janela limitada.
- Barra de progresso da fila (trabalhados / total).
- Some sozinho quando a campanha expira ou a fila zera.
- Botão leva direto para `/corretor/call`, que já abre na entrada rápida com meta + script.
- Se houver mais de uma campanha, mostra a de maior fila e um "+1 outra lista".

### Fase 4 — Validação
Prévia e criação testadas com uma campanha real de teste: conferir por SQL que nenhum lead liberado tem correspondência no pipeline, validar o card no preview do corretor e apagar a campanha de teste.

## Detalhes técnicos

- Migração toca só as duas funções `*_da_base_v2` + a nova função de recálculo (DDL apenas, 1 migração).
- Casamento por `right(telefone_normalizado, 8)` = `base_leads.telefone_key`, padrão já usado no CRM, mais `lower(trim(email))` como segunda chave.
- Frontend: `CriarCampanhaDialog.tsx` (passo Público e rodapé), `useBaseLeads.ts` (tipos do preview), novo `src/components/corretor/OfertaAtivaBanner.tsx` consumindo o `useCampanhasDisponiveis` já criado, montado em `CorretorDashboard.tsx`.
- Sem novas tabelas, sem alteração no fluxo do Mutirão ao vivo.

## Decisões assumidas (avise se for diferente)

- Lead que já foi trabalhado numa campanha anterior e voltou para a base **pode** voltar a ser liberado (respeitando o checkbox "apenas nunca liberados").
- Quem existe no pipeline fica fora da Oferta Ativa **para sempre**, mesmo depois de arquivado — reengajar esse público é papel do Mutirão e da Central de Reengajamento.
