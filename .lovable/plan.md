## Objetivo
Cruzar a base do CSV HubSpot (Lake / Golden Lake / Lake Eyre) com Pipeline de Leads, Negócios e Oferta Ativa, e incluir na Oferta Ativa apenas os leads que **não** existem em nenhuma dessas bases.

## Resultado da auditoria (cruzamento já executado)
O arquivo enviado tem **2.193 contatos**, todos com conversão **Lake Eyre** (não há Golden Lake nem outro empreendimento no arquivo). Cruzamento feito por telefone (chave = 8 últimos dígitos, robusta a variação de DDD e 9º dígito), comparando contra `telefone`/`telefone2`/`telefone_normalizado` de cada base:

```text
Total no CSV ............................. 2.193
 - Telefone inválido (<8 dígitos) ........      2
 - Já em Oferta Ativa ....................  1.160
 - Já no Pipeline de Leads ...............    323
 - Já em Negócios ........................      0
 - Novos a incluir .......................    708
     · com telefone completo válido ......    704  ✅ incluir
     · telefone curto/incompleto .........      4  ❌ descartar
```

**Conclusão: 704 leads novos serão incluídos na Oferta Ativa.**

## O que será feito
1. Inserir os **704 leads** na lista existente **"Lake Eyre"** (`oferta_ativa_leads`), com:
   - `status = 'na_fila'` (disponível para os corretores)
   - `empreendimento = 'Lake Eyre'`
   - `nome` = Nome + Sobrenome do CSV
   - `telefone` normalizado (+55), `telefone_normalizado`, `email`, `campanha` e `origem` vindos do CSV
   - `data_lead` = data de conversão do CSV
2. Atualizar o `total_leads` da lista "Lake Eyre".
3. Re-verificação pós-import confirmando que nenhum dos inseridos colide com Pipeline/Negócios/Oferta Ativa.

## Detalhes técnicos
- Inserção via ferramenta de dados (não migração) na tabela `oferta_ativa_leads`, usando `lista_id = 88476caf-76a2-44dd-b24c-587144c42e33`.
- Dedup interno do CSV já aplicado (0 duplicados internos encontrados).
- Os 4 telefones curtos e os 2 inválidos ficam de fora por não serem acionáveis em ligação.

## Confirmação necessária
- Confirma incluir na lista existente **"Lake Eyre"**? (alternativa: criar uma nova lista, ex. "Lake Eyre - HubSpot Jun/2026").
