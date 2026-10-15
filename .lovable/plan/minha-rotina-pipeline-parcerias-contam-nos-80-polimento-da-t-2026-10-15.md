# Minha Rotina = Pipeline (parcerias contam nos 80%) + polimento da tela

Mockup: /mnt/documents/mockup-minha-rotina-polida.html

## 1. Mesmos números nas duas telas
- A regra dos 80% passa a contar também os clientes em que o corretor é parceiro, igual ao Pipeline.
- Um cliente em parceria conta para os dois corretores.
- A cor de cada cliente (verde/amarelo/vermelho) sai da mesma régua nas duas telas. Ganhos e descartes não entram.
- Atenção: a saúde de todos os corretores pode mudar antes de os 80% ligarem, à 00h de hoje (15/10). Antes de publicar, mostro a lista com a saúde de antes e depois de cada um.

## 2. Polimento da Minha Rotina
- As regras da Roleta viram 3 cartões alinhados (CRM, visitas da semana passada, descartes). Sai a linha solta "1 desatualizado · 8 em atenção".
- O quadro Saúde do CRM mostra as mesmas 3 bolinhas do Pipeline (verde, amarelo e vermelho). Tocar abre o Pipeline já filtrado.
- Os textos ficam mais curtos. "Meu foco de hoje" mostra 3 tarefas e "Ver todas (N)".
- O gráfico de 4 semanas sai da tela.
- A lateral fica igual: Próxima visita e Atalhos (com Oferta Ativa em destaque).

## 3. Validação
- Comparar no banco a contagem da Rafaela com o Pipeline dela (esperado: 34 / 10 / 1).
- Comparar a saúde de antes e depois de todos os corretores.
- Abrir a tela num tamanho de computador e conferir o alinhamento.

## Detalhes técnicos
- Migração em `crm_saude_corretor`: o universo passa a ser os leads em que o corretor é dono ou parceiro ativo (`pipeline_parcerias`), com a mesma classificação de saúde do Kanban. Os campos que a função devolve não mudam.
- Front: `RoletaTurnoCard` (grid com 3 regras), `MinhaEvolucaoKpis` (bolinhas), `CorretorDashboard` (sai `EvolucaoSemanasChart`), tooltip do `PipelineHeader` atualizado.
