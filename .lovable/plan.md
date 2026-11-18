# Pedidos do site e proteção dos leads de teste

## Resultado aprovado no desenho
- Uma nota por pedido, com financiamento quando informado e horário de Brasília.
- Sem cartão: **Busca → Veio do site → Pedidos no site**, para a gestão já autorizada, sem depender de abrir a Jornada.
- Com cartão: atividade de sistema no **Histórico**, sem duplicar o ID do pedido e sem contar como contato humano.
- Testes preservam os dados e as notas, permanecem arquivados e nunca geram distribuição nem aviso ao corretor ou à gestão.

## Fase 1 — proteção dos testes
1. Aplicar a trava central em `leads` e `pipeline_leads`: um pedido novo não pode desmarcar o teste, reativá-lo ou deixá-lo pendente de distribuição. Os dados e as notas continuam sendo gravados.
2. Impedir a distribuição de testes na função central, inclusive quando forçada, sem registrar tentativa de entrega ou enviar avisos.
3. Proteger as entradas de sincronização, retorno e pedidos do site contra reativação e avisos de testes, inclusive quando o encontro acontece por telefone ou vínculo. Não mudar a distribuição e as regras dos leads reais.
4. Após a proteção, arquivar novamente **somente**:
   - `leads` `2ee107a6-df07-40d5-9b7e-3015c312b1c4`.
   - `pipeline_leads` `922c7a75-75f3-417e-a7f3-59d4baf92960`.
   Sem apagar, sem criar cartão para o cadastro que não tem cartão, sem transferir para ninguém e sem perder os dois pedidos.

## Fase 2 — notas na apresentação aprovada
- Mostrar as notas de pedidos no cadastro sem cartão acima dos detalhes expansíveis da Jornada.
- Conservar a atividade única por pedido no Histórico do cartão e sua transferência quando o vínculo existir.
- Não ampliar permissões: o cadastro sem cartão continua acessível só à gestão autorizada e testes continuam ocultos nas buscas operacionais.
- Não alterar `v_lead_timeline` apenas para fazê-la coincidir com uma consulta: o Histórico da ficha já lê as atividades diretamente.

## Fase 3 — validação e entrega
- Todos os dados fictícios de validação ficam **dentro de uma transação revertida** ou ambiente isolado; nenhum lead novo permanece em produção e nenhum destinatário real recebe aviso de teste.
- Testar separadamente: arquivamento nas duas tabelas, preservação de financiamento e horário BRT, uma nota por ID, reenvio sem duplicação, vínculo sem perder dados, zero avisos para corretor/gestão e bloqueio de distribuição normal/forçada.
- Verificar que a regra de teste não bloqueia pedidos e avisos de leads normais; corrigir os testes antigos que indevidamente esperavam aviso para `is_teste=true`.
- Ler novamente os dois cadastros e os registros de avisos/distribuição, além das views de mídia, sem alterar outros dados.
- Revisar o diff e conferir a apresentação em computador e celular 390px. A validação autenticada usa acesso autorizado ao preview; se indisponível, informar essa pendência sem criar conta ou lead em produção nem afirmar que foi validada.
- Entregar o que mudou, o estado final dos dois testes e o que exige publicação.

## Detalhes técnicos
- Usar mudança aditiva de funções/gatilhos, sem apagar ou renomear estruturas, sem alterar cliente de conexão ou permissões existentes.
- Reutilizar a mesclagem `site_mesclar_dados` e os registros únicos existentes; preservar a escrita de dados do site somente pela sincronização.
- A trava de teste deve ser aplicada antes dos gatilhos de reentrada/atribuição. Validar a ordem e garantir que gravações legítimas do site não sejam abortadas.
- Cobrir `sync_site_lead_to_pipeline`, vínculo explícito, `trg_site_voltou_aviso`, `distribuir_lead_atomico` e os caminhos de `crm-webhook`/`site-events` que geram efeitos operacionais.
- Mudança estrutural via ferramenta de migração; arquivamento dos dois cadastros via ferramenta de dados, separado da migração. Respeitar a janela e limite de migrações do projeto.
- Atualizações aplicadas no servidor entram em vigor após aplicação/implantação; a nova apresentação das notas exige publicar o CRM. Não modificar o projeto do site.

**Esta etapa apresenta somente o plano; nenhuma correção no aplicativo ou nos dados será executada antes da aprovação do plano.**