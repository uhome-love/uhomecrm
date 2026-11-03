# Missão de Natal da empresa (Painel CEO e Diretora)

## O que muda
Um quadro novo, **só de leitura**, chamado "Missão de Natal · Uhome", logo abaixo do cartão "Boa noite" no Painel CEO e no Painel da Diretora. Aparece no computador e no celular, só durante o Natal. Nenhum outro bloco muda.

**Conteúdo do quadro:**
- **Cabeçalho:** chave de ouro, "Missão de Natal · 02/11 a 18/12", chip "Faltam X dias".
- **Missão 100 milhões:** VGV assinado da Uhome em 2026, com barra dourada e chave andando, e quanto falta.
- **Corrida das equipes:** cada equipe lado a lado, com VGV da campanha, barra até R$ 10 mi e posição (1º, 2º, 3º), e a frase "Equipe que fizer R$ 10 mi: gerente ganha 2 diárias no Rosa com acompanhante."
- **6 números da empresa na campanha:** leads, visitas agendadas, visitas realizadas, negócios, vendas e VGV.
- **Metas dos corretores:** quantos já definiram meta de Natal e quantos ainda não, e a soma das metas (quem não definiu conta como R$ 1 mi).
- **Destaque da semana:** os 3 corretores com mais visitas realizadas de segunda a hoje.

Antes de construir, mostro um desenho do quadro para você aprovar.

## Detalhes técnicos
- Novo `src/natal/MissaoNatalEmpresa.tsx` e hook `useMissaoNatalEmpresa` em `src/natal/`, reaproveitando `BarraOuro`, `brlCurto` e as constantes de `missao.ts`.
- Dados pela fonte única: `fetchMetricas` sem filtro de corretor (campanha 02/11 até hoje, ano desde 01/01, semana desde segunda), `agruparPorEquipe` para as equipes e `consolidarPorCorretor` para o top 3. Negócios pela contagem de `negocios` no período. Metas lidas de `campanha_natal_metas`, que a direção já pode ver. Atualização a cada 2 minutos.
- Encaixe: uma linha em `src/components/ceo/dashboard/DesktopHeader.tsx`, na seção mobile equivalente do CEO e em `src/pages/DiretoraDashboard.tsx`, logo após a saudação. O quadro só aparece enquanto `isNatal` estiver valendo.
- Sem mudança no banco.
- Validação: abrir os dois painéis no computador e no celular na tela de teste, conferir os totais contra o relatório de vendas e ver se aparece algum erro.
