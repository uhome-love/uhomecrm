# Relatório completo "Movimento Uhome Performance" (PDF para montar a apresentação)

Um relatório em PDF com todos os dados para o Claude montar a apresentação. Ele mostra por que a trava (2 visitas + 80% do CRM) foi boa e onde ainda dá para melhorar. Só leitura: nada muda no CRM.

## 1. Como era antes x o que mudou
- **Antes de 14/10:** qualquer corretor se credenciava na Roleta, sem exigência de visita nem de CRM.
- **Depois:** só entra quem fez 2 visitas na semana anterior e tem 80% do CRM em dia.
- **As tentativas por lead aumentaram:** um lead novo recebia 3,6 registros nos 7 primeiros dias e agora recebe 4,5 (+26%). O contato no 1º dia subiu de 95% para 99%.
- **Estagnados:** o sistema não guarda a foto de cada dia, então não dá para comparar com o "antes" com exatidão. No lugar, mostro o número de hoje e o CRM em dia por semana.

## 2. Descarte: como aumentou
- Foi de 992 para 1.497 em 4 semanas (+51%), enquanto os leads subiram só 20%.
- No relatório: descartes por semana, por motivo e por corretor, e em quantos dias depois da entrada o lead é descartado.

## 3. Leads com tarefa e próxima ação evoluem mais? Sim
- Leads com tarefa registrada nos 7 primeiros dias chegam à visita realizada **5 vezes mais** (7,7% contra 1,4%).
- E são descartados menos nas 2 primeiras semanas (19,8% contra 27,2%).
- (Leads de 14/09 a 25/10. O grupo sem tarefa é pequeno, 147 leads, e isso fica anotado no relatório.)

## 4. Quem fez 10 visitas ou mais vendeu? Sim, todos os 7
- Pedro Jorge (15 visitas, 2 vendas), Jéssica França (13, 2), Marcos Aurelio Farias (12, 1), Adriana Kaiser (12, 1), Thalia de Oliveira (10, 1), Rafaela Campos (10, 1) e Ebert Silva (10, 1).
- Juntos, fizeram 9 das 18 vendas do período.

## 5. Quem vendeu depois da trava
- 18 vendas por corretor, com VGV (parceria 50/50) e empreendimento, sem nome de cliente, cruzadas com a subida das visitas.

## 6. Plano de melhorias
1. **Descartar menos para aproveitar mais:** mais tentativas antes de descartar e revisão do descarte rápido.
2. **Mais tentativas de contato registradas**, sempre com tarefa e próxima ação marcadas.
3. **Oferta Ativa** para quem ficou fora da Roleta.
4. **Confirmar a visita no dia anterior** para reduzir o no-show.

## 7. Conteúdo do PDF (versão 2)
Como era antes x regra nova, resumo, tabela antes x depois, gráficos semanais (visitas, CRM e trabalho, vendas, Oferta Ativa, descartes), Roleta por semana, visitas por corretor, quem vendeu, os itens 2 a 4 acima, plano de melhorias, mensagens-chave prontas para os slides e limites dos dados.

Arquivo: Relatorio_Progresso_Trava_Roleta_v2.pdf. Antes de entregar, confiro todas as páginas em imagem.

## Detalhes técnicos
- Vendas: `v_negocios_pipeline`. Descartes: `pipeline_historico` → etapa tipo descarte. Tentativas: `pipeline_atividades` nos 7 dias depois da criação do lead. Tarefas: `pipeline_tarefas` criadas nos 7 primeiros dias. Datas em BRT.
- Gerado com reportlab + matplotlib.

## 8. Guia do corretor (com metas tiradas dos números)
As metas exatas saem dos números reais dos 7 corretores com 10 visitas ou mais, que fizeram metade das vendas. Faço a conta na construção e mostro de onde vem cada meta.
- **Para entrar na Roleta (quem está fora):** quantas ligações por dia na Oferta Ativa são necessárias para chegar a 2 visitas na semana (pela conversão real de ligação em visita), mais follow-up registrado nos leads da carteira e menos descartes. O CRM em dia precisa ficar em 80% ou mais.
- **Para se manter (quem está dentro):** 2 visitas por semana com folga (meta de 3), CRM acima de 85%, tarefa e próxima ação em todo lead, confirmação da visita no dia anterior e descartar só depois de várias tentativas registradas.
- **O corretor ideal:** a rotina semanal dos que mais venderam, com números para bater: visitas por semana, registros por lead nos primeiros 7 dias, tarefas concluídas, ligações e no máximo um certo percentual de descarte. Fecha com a conta "visitas → vendas" da Uhome hoje: cerca de 1 venda a cada 10 visitas.
