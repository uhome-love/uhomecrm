# Notificação de novo lead no WhatsApp — apontar CRM para `novo_leaduhome`

## Situação

O template novo já foi criado na Meta: **`novo_leaduhome`**, categoria Utilidade, Portuguese (BR), status **Em análise**, com 2 variáveis posicionais ({{1}} nome, {{2}} empreendimento), cabeçalho "Novo lead recebido!", rodapé "UhomeSales · CRM" e botão "Abrir no CRM".

O CRM ainda envia o template antigo `novo_lead` com 4 parâmetros, e é isso que gera o erro `(#100) Invalid parameter — Parameter name is missing or empty` (232 falhas em 7 dias) e o alerta "Edge function instável: whatsapp-notificacao".

Telefone e e-mail ficam fora da notificação de propósito: o corretor só vê contato depois de aceitar o lead no CRM.

---

## O que será feito

1. **Apontar para o template novo** — `whatsapp-notificacao` passa a enviar `novo_leaduhome` com apenas 2 parâmetros posicionais: nome e empreendimento.
2. **Fallback automático pela Evolution** — se a Meta responder erro (`#100`, `#132xxx`, template ainda não aprovado), a mesma notificação sai como texto livre pela Evolution API, sem telefone/e-mail no corpo. O aviso nunca se perde enquanto o template estiver "Em análise".
3. **Parar o alerta falso** — registrar também os envios com sucesso em `ops_events`, para o painel de saúde deixar de mostrar 100% de erro.
4. **Validação ao vivo** — enviar uma notificação de teste para um corretor de teste, conferir a chegada no WhatsApp e o evento de sucesso no painel `/admin/ingestao`. Enquanto o template estiver em análise, a validação comprova o caminho Evolution; assim que a Meta aprovar, repetimos o teste pelo template.

## Detalhes técnicos

- `supabase/functions/whatsapp-notificacao/index.ts`:
  - `TEMPLATE_MESSAGES.novo_lead` → `name: "novo_leaduhome"`, `parameters: [nome, empreendimento]`.
  - Envolver o POST da Graph API com checagem de `json.error?.code`; em erro, chamar o envio Evolution (`EVOLUTION_API_URL` + `EVOLUTION_API_KEY`, `POST /message/sendText/{instancia}`) com o texto espelhado do template.
  - `logOps("info", ...)` no sucesso, com o canal usado (`meta` ou `evolution`).
- Sem migração de banco. Nenhuma mudança de frontend.
