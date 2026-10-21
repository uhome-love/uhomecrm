# Open Arvoredo: Meta mostra 24 leads e o CRM mostra 18

## O que encontrei (só leitura, nada foi alterado)
Os leads chegaram. A diferença vem da forma de contar:

- **17 clientes novos** da campanha "Open Arvoredo v1" entraram hoje, mais 1 Open Arvoredo de outra origem. Esses são os 18 do painel.
- **4 clientes que já estavam no CRM** preencheram o formulário de novo hoje: Amanda Neves, Dionata Sales, Allan Lima e "construtora amorim". O CRM não cria um cliente repetido. Ele registra "novo interesse" no cliente que já existe e manda para a Roleta. Para a Meta, cada um conta como lead novo. Para o painel "Leads por Empreendimento", não conta, porque o cliente não é novo.
- Isso dá **21 ou 22**, conforme o fuso. A Meta fecha o dia em outro horário, e a Pam entrou perto da meia-noite.
- Faltam **2 ou 3** que eu não consegui explicar só com os dados do CRM.

## O que proponho
1. **Achar os 2 ou 3 que faltam:** puxar da Meta a lista de leads de hoje do formulário do Open Arvoredo e comparar um por um com o CRM. Se algum não tiver entrado, eu trago para o CRM pela rotina de recuperação que já existe. Não vou criar nada à mão.
2. **Painel mais claro:** em "Leads por Empreendimento", mostrar ao lado do número quantos clientes antigos voltaram. Por exemplo: "Open Arvoredo 18 (+4 retornos)". Assim o número chega mais perto do que a Meta mostra. A conta atual não muda.

## Detalhes técnicos
- Passo 1: rodar o `meta-leads-backfill` em modo de verificação, só para o form do Open Arvoredo, e comparar o `meta_lead_id` com `pipeline_leads`.
- Passo 2: contar as atividades `tipo='entrada'` do dia por empreendimento, em leads criados antes do período, e mostrar no `DesktopLeads`/`MobileLeads`. Só muda a tela.
