# Auditoria completa da modernização visual do CRM (Fases 1 a 5)

Objetivo: revisar tudo o que mudou ontem (topo, abas, menu lateral, cabeçalhos, cartões, seletor de período, Financeiro, Vendas, Intermediação, Performance, Oferta Ativa, Reengajamento, Imóveis, Usuários/Meu time, sino de notificações) e entregar uma lista do que ainda dá para melhorar. Nesta etapa nada é alterado no CRM.

## O que vou conferir

1. **Todas as páginas, com 3 contas:** CEO (você), gerente (Gabriel) e um corretor. Telas de 1280, 1440 e 1920, claro e escuro.
2. **Visual:** cabeçalho igual em todas, cartões de números no mesmo padrão, botões (principal azul, demais discretos), cores fora do padrão, textos cortados, alinhamentos, espaços sobrando ou apertados, telas vazias sem orientação.
3. **Experiência:** busca do topo (⌘K), abas (limite de 6, "Fechar as outras"), menu lateral (rolagem, grupos, nomes), seletor de período e "Personalizado", filtros, carregamento lento.
4. **Erros:** erros na tela e no console, páginas que demoram, números zerados indevidos, links quebrados.
5. **Pendências já conhecidas de ontem:**
   - aba diz "Usuários" quando o gerente abre "Meu time";
   - sombra no rodapé do menu não feita;
   - cartões de imóvel com alturas diferentes;
   - Configurações com menu de seções em cima (não à esquerda);
   - Intermediação sem etiquetas de situação;
   - "Personalizado" ainda sem o seletor novo em algumas páginas;
   - sino com "Ativar notificações" ainda não visto na tela;
   - celular não conferido depois das mudanças.

## O que você recebe

- Um relatório em PDF com prints de cada página e, para cada problema: onde está, o que acontece, gravidade (quebra / atrapalha / acabamento) e sugestão.
- Uma lista priorizada em ondas pequenas (ex.: Onda A erros, Onda B consistência, Onda C acabamento), para você escolher o que aprovar.

## Regras

- Somente leitura: sem clicar em ações que mudem dados de leads reais.
- Depois do relatório, cada onda segue o padrão: desenho → plano → sua aprovação → construção → conferência ao vivo.

## Detalhes técnicos

- Varredura com Playwright usando sessões minted (CEO, gerente, corretor), capturando screenshots, console e erros de rede por rota do `pageRegistry`.
- Checagem de cores fora dos tokens (`shell-*`, semânticos) via busca no código, e de páginas sem `PageHeader`/`KpiCard`/`PeriodSelector`.
- Relatório gerado em `/mnt/documents/auditoria_visual_crm.pdf`.
