# Painel CEO mobile — validação

## Escopo executado
Plano aprovado: `.lovable/plan/painel-do-ceo-no-celular-primeira-etapa-de-gestão-2026-10-20.md`.
Apresentação móvel e extração das seções desktop; consultas e regras comerciais mantidas.

## Evidências
- Preview autenticado como CEO, usando dados reais somente para leitura.
- 360, 375, 393, 430px: sem overflow horizontal da página. Claro e escuro verificados pela preferência real do app.
- Períodos Hoje, Ontem, Semana, Mês, 30 dias e personalizado 01/10–19/10; inputs de data computados em 16px.
- Atualização, indicadores deslizáveis e expansões de detalhes, funis, conversões, vendas, equipes, totais, ranking, marketing e RH.
- Detalhamentos de leads e estados de visita abertos e fechados, sem acessar ou modificar clientes.
- Treze KPIs de mobile e desktop comparados na mesma sessão/período: idênticos.
- Todos os sete indicadores por equipe e linha de totais comparados: idênticos.
- Baseline desktop de outubro comparado: conteúdo preservado; variações são dados vivos. Transparência da linha desktop conferida como rgba(255,255,255,0.5).
- Abas Visão geral/Performance da Roleta nas três páginas verificadas com acesso do CEO. Não equivale a validação autenticada como diretora ou gerente.
- Data futura sem movimentos: leads zero e vendas vazias, situação atual de negócios mantida.
- Falha essencial de KPI simulada somente no navegador: erro exibido, sem mensagem de operação saudável; recuperação após retirar interceptação e clicar Tentar de novo.
- Nenhuma gravação em pipeline, visitas, negócios, distribuição ou credenciamentos durante os testes.
- Logs finais de compilação: build OK; testes fmtMoney e routePatterns: 22 aprovados.

## Limitações
- Fila CEO real vazia, botão desabilitado. Abertura/fechamento e distribuição de fila com itens não foram validados; tentativas locais não verificaram esse fluxo.
- Teste preexistente id-mapping-regression: 3 falhas por referências a arquivos movidos para src/_legacy, fora do escopo do redesign; 1 caso aprovado. Não alterado.
- Contas próprias de diretora e gerente não foram utilizadas; permissões e fontes de dados não alteradas.
- Aguarda validação de Lucas antes da próxima etapa.

Capturas e scripts de validação no sandbox: `/tmp/browser/painel-ceo-mobile/qa/` e `/tmp/browser/painel-ceo-mobile/qa-final/`.