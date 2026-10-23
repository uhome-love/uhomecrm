# Fase 3 — validação e pendência final

## Validado com a conta do Lucas
- Cliente isolado `TESTE JORNADA 23 OUT`; nenhum cliente real utilizado nas gravações.
- Proposta: cancelar sem mudar a etapa; salvar empreendimento Connect JW/Cyrela, unidade 321 e R$ 298.000; reabrir e conferir.
- Documentação: RG/CPF marcado, renda e residência desmarcados; incompletude não bloqueou a passagem. Checklist recuperado nas leituras seguintes.
- Contrato: dados reaproveitados, situação Gerado/Em leitura e previsão 28/10/2026; previsão não preenchia assinatura oficial.
- Formulário aguardava consulta fresca antes de inicializar: correção aplicada após reproduzir reabertura com observação antiga em cache.
- Confirmação de venda: unidade 321 e R$ 298.000 sugeridos; botão bloqueado sem intermediação e comprovante; cancelamento realizado em computador e celular.
- Intermediação: tela abriu com o cliente escolhido, sem modalidade de pagamento pré-selecionada; não foi gerado documento.
- Aba Negócio: observação salva, reaberta e lida pelo mesmo formulário no computador e celular.
- Aba Negócios: menu abriu Proposta; cancelar manteve Contrato; salvar pelo menu persistiu. Arrastar para Contrato abriu jornada, salvou e o cliente reaberto conservou unidade/valor. Menu no celular abriu a mesma proposta e cancelou.
- Recusa no servidor por unidade/valor incompletos conservou unidade 321 e proposta R$ 298.000.
- Aviso de teste: 8 dias gerou 1 aviso; segunda chamada criou 0 e deduplicou 1. Salvar a mesma situação conservou o relógio; mudança para Em leitura reiniciou e não gerou aviso. O aviso abriu o cliente no Pipeline.
- Execuções finais do navegador sem erros de execução. Testes focados: 17 aprovados em jornada, confirmação e pagamento. Último registro do preview: build OK. Revisão de alterações sem erros de espaços.

## Limpeza e preservação
- Cliente `47dc6414-f124-4f83-9823-b22f80f56bca`, negócio `42555b00-b441-49a5-8d47-c4ad69016ec2`, atividades e aviso fictícios removidos; leituras finais confirmaram 0 registros remanescentes.
- Nenhum anexo/intermediação foi criado nesta validação.
- Antes e depois: **115 vendas ativas; VGV R$ 63.459.987,29**.
- A definição instalada de `trg_proteger_lead_ganho` permite nova negociação e protege responsável/aceite/arquivamento; a hipótese de bloqueio de qualquer nova jornada vinha de uma leitura desatualizada e não exige alteração nesta fase.
- Cron diário confirmado como `0 11 * * *`, timezone GMT: 08h BRT. Aviso genérico continua somente às segundas. Entrega real de push num aparelho não foi testada; link no aviso da aplicação foi testado.

## Pendente: proteção do relógio contra escrita concorrente
**Não declarar Fase 3 concluída nem avançar para Vendas antes desta correção.**

O trigger adicionado considera mudança em `flag_status.status_contrato` uma mudança intencional. Um escritor antigo de tarefa/atividade pode enviar o JSON completo de um estado anterior, alterando esse valor acidentalmente e reiniciando o prazo.

Correção aditiva dentro do escopo aprovado, **somente após 19h BRT**:
1. Usar a situação do contrato no negócio atual como referência autoritativa. O relógio deve acompanhar mudança real dessa situação e entrada/saída da etapa, não qualquer regravação de flags do lead.
2. Preservar a projeção da situação no lead em escritas não comerciais, sem bloquear tarefas/visitas e sem alterar suas regras.
3. Não atribuir data a contratos antigos sem referência; não modificar ganhos anteriores. Usar a ferramenta de migração, sem reescrever 0027.
4. Teste isolado: ler snapshot do lead, mudar Gerado → Em leitura pela jornada, enviar o snapshot antigo com alteração de uma flag de tarefa; confirmar que situação Em leitura e `desde` permanecem. Confirmar que avanço real ainda reinicia o relógio, sair da etapa remove o acompanhamento e ganhos continuam intocados.
5. Repetir teste do aviso/deduplicação, limpar fixture e reconferir total/VGV. Solicitar validação do Lucas antes da fase 4.

Bloqueio: janela de alteração no banco definida no plano aprovado; não há trabalho automático programado para após o fim desta conversa.