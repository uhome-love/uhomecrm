# Relatório completo "Movimento Uhome Performance" (PDF para montar a apresentação)

Um relatório em PDF com todos os dados para o Claude montar a apresentação. Ele mostra por que a trava (2 visitas + 80% do CRM) foi boa e onde ainda dá para melhorar com a Oferta Ativa. Só leitura: nada muda no CRM.

## 1. Como era antes x o que mudou
- **Antes de 14/10:** qualquer corretor se credenciava na Roleta, sem exigência de visita nem de CRM.
- **Depois:** só entra quem fez 2 visitas na semana anterior e tem 80% do CRM em dia.
- **As tentativas por lead aumentaram:** um lead novo recebia 3,6 registros nos 7 primeiros dias e agora recebe 4,5 (+26%). O contato no 1º dia subiu de 95% para 99%.
- **O descarte aumentou:** foi de 992 para 1.497 em 4 semanas. Parte vem dos 20% a mais de leads e de qualificar mais rápido. Fica registrado como ponto a acompanhar.
- **Estagnados:** o sistema não guarda a foto de cada dia, então não dá para comparar com o "antes" com exatidão. No lugar, mostro o número de hoje e o CRM em dia por semana.

## 2. Quem vendeu depois da trava (12/10 a 11/11)
- 18 vendas por corretor, com VGV (parceria 50/50) e empreendimento, sem nome de cliente.
- Cruzamento com a subida das visitas. Exemplos: Jéssica França (+10 visitas, 2 vendas), Marcos, Adriana, Ebert, Rafaela Campos, Thalia, Pedro Jorge.

## 3. Conteúdo do PDF (versão 2)
1. Como era antes x a regra nova
2. Resumo com os números principais
3. Tabela antes x depois: visitas, corretores visitando, visitas por lead, no-show, atividades, tarefas, tentativas por lead, contato no 1º dia, descartes, leads, Oferta Ativa, vendas e VGV
4. Gráficos semanais: visitas, CRM e trabalho, vendas, Oferta Ativa e descartes
5. Roleta por semana: aptos, CRM médio, quem bateu as 2 visitas
6. Visitas por corretor, antes x depois
7. Quem vendeu depois da trava
8. Oportunidades: Oferta Ativa, metade do time fora da Roleta, no-show, descarte
9. Mensagens-chave prontas para os slides e limites dos dados

Arquivo: Relatorio_Progresso_Trava_Roleta_v2.pdf. Antes de entregar, confiro todas as páginas em imagem.

## Detalhes técnicos
- Vendas: `v_negocios_pipeline` (ganho, data_assinatura em BRT). Descartes: `pipeline_historico` → etapa tipo descarte. Tentativas: `pipeline_atividades` nos 7 dias depois da criação do lead.
- Gerado com reportlab + matplotlib.
