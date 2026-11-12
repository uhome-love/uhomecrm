# Apresentação "Movimento Uhome Performance" para o time

Uma apresentação para mostrar ao time por que a trava (2 visitas + 80% do CRM) foi boa e onde ainda dá para melhorar com a Oferta Ativa. Também acrescento quem vendeu depois que as visitas subiram. Só leitura: nada muda no CRM.

## 1. Como era antes x o que mudou
- **Antes de 14/10:** qualquer corretor se credenciava na Roleta, sem exigência de visita nem de CRM.
- **Depois:** só entra quem fez 2 visitas na semana anterior e tem 80% do CRM em dia.
- **As tentativas por lead aumentaram:** um lead novo recebia 3,6 registros nos 7 primeiros dias e agora recebe 4,5 (+26%). O contato no 1º dia subiu de 95% para 99%.
- **O descarte não diminuiu, aumentou:** foi de 992 para 1.497 em 4 semanas. Parte vem dos 20% a mais de leads e de mais trabalho na carteira, porque o corretor qualifica e descarta mais rápido. A apresentação mostra isso com honestidade, como ponto a acompanhar.
- **Estagnados:** o sistema não guarda a foto de cada dia, então não dá para comparar com o "antes" com exatidão. No lugar, mostro o número de hoje e o CRM em dia por semana (78%, 88%, 80%, 80%). Guardar essa foto semanal daqui para frente seria uma tarefa separada.

## 2. Quem vendeu depois da trava (12/10 a 11/11)
- 18 vendas por corretor: número de vendas, VGV e empreendimentos, sem nome de cliente.
- Cruzamento com as visitas: quem aumentou as visitas e vendeu. Exemplos: Jéssica França (+10 visitas, 2 vendas), Marcos, Adriana, Ebert, Rafaela Campos, Thalia e Pedro Jorge.
- O VGV segue a regra oficial: parceria dividida 50/50.
- Também entra no relatório, numa versão 2 em PDF.

## 3. Apresentação (11 slides, PowerPoint + PDF)
1. Capa: Movimento Uhome Performance, 1 mês de resultados
2. Antes, todo mundo se credenciava. A regra nova: 2 visitas + 80% do CRM
3. As visitas dobraram: de 91 para 182 (gráfico)
4. Mais gente visitando: de 13 para 22 corretores por semana
5. CRM mais vivo: +50% de atividades, +57% de tarefas, +26% de tentativas por lead, 99% de contato no 1º dia
6. Resultado: de 3 para 17 vendas, de R$ 1,6 mi para R$ 8,6 mi
7. Quem subiu as visitas e vendeu (destaques)
8. Onde ainda dá para crescer: a Oferta Ativa está parada (~540 ligações por semana, contra até 1.733 em setembro) e só metade do time bate as 2 visitas
9. Pontos de atenção: descarte e no-show subiram
10. Recado prático: quem ficou fora da Roleta liga na Oferta Ativa; confirmar a visita no dia anterior
11. Fechamento: o próximo desafio

Tom de reconhecimento. Nomes só nos destaques positivos; os pontos de melhoria são mostrados para o time todo.

## Entrega
- `Apresentacao_Uhome_Performance.pptx` + PDF e `Relatorio_Progresso_Trava_Roleta_v2.pdf`.
- Cores da marca Uhome e um número grande ou um gráfico por slide; confiro cada slide em imagem antes de entregar.

## Detalhes técnicos
- Vendas: `v_negocios_pipeline` (ganho, data_assinatura em BRT). Descartes: `pipeline_historico` → etapa tipo descarte. Tentativas: `pipeline_atividades` nos 7 dias depois da criação do lead.
- Gerado com pptxgenjs, com validação e renderização.
