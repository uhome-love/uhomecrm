# Fase 4 — Gestão e números (Financeiro, Vendas, Intermediação, Relatórios)

Só visual e usabilidade. Nenhuma conta, regra de comissão, parcela, VGV ou permissão muda. Uma página por vez, conferindo os números antes e depois.

## 1. Financeiro
- **Datas no formato brasileiro**: os campos De/Até passam a mostrar dia/mês/ano (hoje 11/01/2026 aparece no lugar de 01/11).
- **"Mês" acompanha o período**: quando o período cobre um mês inteiro, o campo Mês mostra esse mês em vez de "Escolher". Escolher um mês preenche De/Até.
- **Seletor de período padrão** (Hoje, Ontem, Semana, Mês, 30 dias, Personalizado), igual ao das outras páginas.
- **Saldo pendente em destaque**: sai do rodapé e vira o primeiro cartão do topo, com quantas parcelas estão em aberto.
- Cartões de números no padrão novo (Recebido, A receber 30 dias, Repasses pendentes). Tabelas com status coloridos e telas vazias com orientação.

## 2. Vendas
- Cabeçalho, filtros (incluindo atalho mês/ano) e cartões no padrão novo.
- Ranking e lista com o mesmo visual de tabela do Financeiro. Pendências ("Resolver") ganham destaque discreto em âmbar.

## 3. Intermediação
- Cabeçalho e lista no padrão; status (gerada, assinada, em dúvida) com etiqueta de cor; botão principal único "Nova intermediação".

## 4. Relatórios / Performance
- Os 4 controles de visão do topo viram um só seletor organizado.
- **Comparação justa**: a seta verde/vermelha compara com o mesmo pedaço do período anterior até o dia de hoje (ex.: seg–ter desta semana contra seg–ter da semana passada), em vez da semana inteira anterior. Isso muda só a comparação exibida, não os números do período.

## Como valido
- Para cada página: guardo os números antes, troco o visual, confiro que ficaram iguais (exceto a comparação dos Relatórios, que mostro antes/depois para você).
- Conferência em telas de 1280 e 1920, como CEO; celular não muda.

## Detalhes técnicos
- Reaproveitar `PeriodSelector`, `KpiCard`, `PageHeader`, `EmptyState`; formatação de data com `formatBRT`/date-fns `ptBR`.
- Financeiro continua lendo os mesmos agregados do servidor; filtros só mudam estado de tela.
- Comparação de Relatórios: período anterior recortado até o mesmo dia/horário relativo em BRT, calculado no frontend sobre as mesmas consultas.
- Nenhuma migration.
