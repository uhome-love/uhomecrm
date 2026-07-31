# Corrigir notificação de novo lead no WhatsApp (função instável)

## O que está acontecendo (verificado nos dados)

O alerta "Edge function instável: whatsapp-notificacao" é real e vem de uma falha 100% silenciosa:

- **232 falhas em 7 dias**, todas do mesmo tipo: `novo_lead` (a mensagem que avisa o corretor que ele recebeu um lead). Última falha: hoje 18:54 BRT.
- Erro devolvido pela Meta em todas: `(#100) Invalid parameter — Parameter name is missing or empty`.
- Traduzindo: o template `novo_lead` no WhatsApp Business foi (re)criado com **variáveis nomeadas** (`{{nome}}`, `{{telefone}}`…), mas o CRM envia as variáveis **por posição** (1, 2, 3, 4). A Meta rejeita e a mensagem nunca sai.
- Consequência prática: **nenhum corretor está recebendo o aviso de novo lead por WhatsApp** — provavelmente há dias. Os avisos de SLA/1h/repasse são texto livre e continuam funcionando.

Detalhe secundário: essa função só registra **erros** no monitor (nunca registra sucesso). Por isso o vigia de saúde a enxerga como "100% de erro" mesmo quando parte dos envios dá certo — o alerta fica barulhento e pouco confiável.

## O que será feito

### Fase 1 — Descobrir o formato real do template (leitura, sem mudança)
Consultar na API da Meta a definição atual do template `novo_lead` (nome exato das variáveis, idioma, se tem cabeçalho/botões) para corrigir com o dado certo, em vez de adivinhar.

### Fase 2 — Corrigir o envio
- Enviar os parâmetros no formato que o template exige. Se for nomeado, cada parâmetro vai com o seu `parameter_name`; se o template estiver posicional, mantém como está.
- Nunca enviar variável vazia (a Meta também rejeita string vazia) — todo campo sem valor vira um texto seguro ("Não informado").
- Se a Meta recusar o template por formato, o CRM manda **a mesma informação em texto simples** como plano B, para o corretor não ficar sem aviso.

### Fase 3 — Reduzir alarme falso e dar visibilidade
- Registrar também os envios com sucesso, para o vigia calcular taxa de erro de verdade.
- No alerta, mostrar o motivo resumido (ex.: "template rejeitado pela Meta") em vez de só "instável".

### Fase 4 — Validação ao vivo
- Disparar um envio de teste `novo_lead` para um número interno e confirmar recebimento no celular.
- Conferir no monitor que a última hora fica sem erro e com sucessos registrados.
- Confirmar com um corretor que o aviso de lead novo voltou a chegar.

## Detalhes técnicos

- `supabase/functions/whatsapp-notificacao/index.ts`: montagem do bloco `template.components[].parameters` com suporte a `parameter_name`, sanitização de valores vazios, fallback para `type: "text"` em erro 100/132, e `logOps("info", …)` no caminho de sucesso.
- Leitura do template via `GET /{WABA_ID}/message_templates?name=novo_lead` usando o token já configurado (somente leitura, feita dentro de uma execução da função de diagnóstico).
- Sem migration de banco nesta correção.

## Observação
Não vou mexer no conteúdo aprovado do template na Meta — a correção é do lado do CRM, para falar o dialeto que o template já usa.
