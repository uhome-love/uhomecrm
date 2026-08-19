# Relatório de trabalho — Empreendimento Flow (para o incorporador)

Entregável: um relatório de prestação de contas do trabalho da Uhome sobre a verba de mídia do Flow, em formato pronto para o Claude montar a apresentação (documento com números + tabelas + arquivo de dados anexo). Não altera nada no CRM — é só leitura e geração de arquivo.

## O que já foi verificado na base (números preliminares)

- Leads Flow no pipeline: **151** por empreendimento canônico (**160** contando também campanha/formulário/anúncio com "Flow"). Primeiro lead **11/11/2025**, último **10/08/2026**.
- Situação atual dos leads: Descarte 95 · Qualificação 26 · Sem Contato 19 · Aquecimento 9 · Visita 1 · Novo Lead 1.
- Visitas registradas: **24 no total** — 11 realizadas e 13 no-show.
- Negócios abertos: **7 em negociação** (sem VGV final preenchido ainda).
- Investimento de mídia lançado em `marketing_entries` com campanha "Flow": **R$ 3.517,33** em 32 linhas diárias — número visivelmente parcial, precisa ser conferido antes de ir para o incorporador.
- Reengajamento: ainda não medido — a consulta precisa passar pelas tabelas certas (`reengajamento_dispatch_queue` / `reengajamento_meta_disparos` / `comunicacao_historico`), o que será feito na execução.

## Conteúdo do relatório

1. **Capa e período** — Flow, período coberto (11/11/2025 a hoje) e escopo.
2. **Resumo executivo** — 6 números-chave: leads gerados, leads trabalhados (com ao menos um contato humano), reengajamentos disparados, visitas totais, visitas realizadas, negócios em andamento.
3. **Funil do Flow** — leads → contatados → qualificados → visitas marcadas → visitas realizadas → negócios, com taxa de conversão em cada passo.
4. **Origem dos leads** — por campanha/anúncio/formulário e por canal (Meta, site, indicação), com investimento por campanha e custo por lead / por visita.
5. **Trabalho de atendimento** — volume de atividades registradas (ligações, WhatsApp, mensagens), tempo médio até o primeiro contato, número de corretores envolvidos.
6. **Reengajamento** — quantos leads frios receberam disparo, quantos responderam, quantos voltaram para atendimento ativo.
7. **Visitas** — lista detalhada (data, cliente anonimizado ou nome, corretor, resultado) e comparativo realizadas × no-show.
8. **Situação atual da carteira** — onde estão os 151 leads hoje e o que segue em trabalho.
9. **Notas de método** — definição de cada métrica (visita conta 1 por cliente/dia, fuso BRT, o que é descarte reengajável etc.), para o número não ser questionado.

## Formato de entrega

- `relatorio-flow.xlsx` — abas: Resumo, Funil, Leads (linha a linha), Visitas, Reengajamento, Mídia.
- `relatorio-flow.md` — o texto do relatório com todos os números e tabelas, pronto para o Claude transformar em apresentação.

## Detalhes técnicos

- Fonte dos leads: `pipeline_leads` filtrado por `empreendimento_canonico_id = 0d4aa2d5-…` **unido** ao match textual em `campanha/formulario/anuncio/empreendimento`, deduplicado por id (cobre os leads antigos sem canônico).
- Visitas: `v_fato_visita` / `visitas` pelo mesmo conjunto de leads, aplicando a definição canônica de visitas (exclui canceladas e origem `backfill_*`).
- Atividades e toques: `pipeline_atividades` (coluna de vínculo a confirmar) + `comunicacao_historico`.
- Reengajamento: `reengajamento_dispatch_queue`, `reengajamento_meta_disparos` e `reengajamento_eventos` cruzados com o conjunto de leads.
- Mídia: `marketing_entries` (linhas diárias, campo `periodo` texto) filtrado por campanha do Flow — validar cobertura antes de publicar o custo por lead.
- Tudo em BRT. Somente leitura (SELECT), sem migration e sem alteração de código do CRM.

## Pontos a confirmar antes de finalizar

- Período do relatório: histórico completo desde nov/2025 ou apenas a janela em que houve verba de mídia?
- Incluir nomes reais dos clientes nas visitas ou anonimizar?
- Mostrar o investimento de mídia e o custo por lead, ou só o volume de trabalho?
