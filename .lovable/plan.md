# Notificação de novo lead no WhatsApp — template Meta + fallback Evolution

## Situação

O envio de "novo lead" usa o template `novo_lead` no WhatsApp Cloud API com 4 variáveis **posicionais** ({{1}}..{{4}}). O template aprovado hoje na Meta está com **parâmetros nomeados**, e por isso a Meta devolve `(#100) Invalid parameter — Parameter name is missing or empty` (232 falhas em 7 dias).

Duas frentes: (A) subir um template novo com variáveis posicionais e apontar o CRM para ele; (B) manter a Evolution API como caminho alternativo, já que ela envia texto livre sem template.

---

## A) Modelo para subir na Meta

**Nome:** `novo_lead_v2`
**Categoria:** Utility (Utilidade)
**Idioma:** Português (BR) — `pt_BR`
**Cabeçalho:** Texto, sem variável → `Novo lead recebido`

**Corpo (copiar e colar exatamente):**

```text
Você recebeu um novo lead no UhomeSales.

Nome: {{1}}
Empreendimento: {{2}}

Aceite o lead em até 10 minutos para ver os dados de contato.
```

**Rodapé:** `UhomeSales · CRM`

**Botão (opcional, recomendado):** Botão de URL estática
- Texto: `Abrir no CRM`
- URL: `https://uhomesales.com/pipeline`

**Exemplos de amostra (a Meta exige preencher para aprovar):**

| Variável | Exemplo |
| --- | --- |
| {{1}} | Maria Silva |
| {{2}} | The Arch |

Telefone e e-mail ficam fora da notificação de propósito: o corretor só vê os dados de contato depois de aceitar o lead no CRM (mesma regra do mascaramento de PII do pipeline).

Importante: ao criar as variáveis, usar o modo **numerado ({{1}}, {{2}})**, nunca o modo "nome do parâmetro". É a troca para o modo nomeado que quebra o envio hoje.


---

## B) O que muda no CRM depois da aprovação

1. `whatsapp-notificacao` passa a usar `novo_lead_v2` com apenas 2 parâmetros posicionais (nome, empreendimento) — telefone e e-mail saem do payload.
2. Fallback automático: se a Meta responder erro `#100` / `#132xxx` (template inválido ou não aprovado), a função reenvia a mesma notificação como **texto livre pela Evolution API** usando a instância do corretor, para o aviso nunca se perder.
3. Registrar sucesso em `ops_events` (hoje só o erro é logado), o que encerra o alerta falso de "100% de erro" da função.
4. Validação ao vivo com um lead de teste: conferir a chegada no WhatsApp do corretor e o evento de sucesso no painel de saúde.

## Detalhes técnicos

- `supabase/functions/whatsapp-notificacao/index.ts`: renomear o template em `TEMPLATE_MESSAGES.novo_lead`, envolver o `fetch` da Graph API em try/catch com checagem de `error.code`, e acionar o envio Evolution (`EVOLUTION_API_URL` + `EVOLUTION_API_KEY`, endpoint `/message/sendText/{instancia}`) quando a Meta falhar.
- Texto do fallback Evolution espelha o corpo do template, em uma única mensagem.
- Nenhuma migração de banco necessária.
