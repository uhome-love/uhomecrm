# Campanha Meta Open Bosque — preparar roleta e CRM

## O que encontrei (verificado)
- **Roleta:** a regra do Open Bosque existe, mas está **desligada**. Leads do anúncio cairiam na Fila do CEO, sem ir para os corretores.
- Essa regra aponta para um grupo de corretores diferente do que usamos no reengajamento de hoje (MCMV). Preciso que você confirme o grupo.
- **Formulário novo** ("Uhome - Open Bosque- Video Lucas - 2 perguntas", criado hoje): o CRM ainda não conhece. Os dois formulários antigos do Open Bosque estão cadastrados (último lead em 01/06).
- O produto Open Bosque já está ativo e tem 10 corretores alocados.

## O que vai ser feito
1. **Ligar a regra do Open Bosque na roleta**, no grupo que você confirmar. Assim, os leads vão para os 10 corretores alocados, com 10 minutos para aceitar.
2. **Cadastrar o formulário novo**, buscando o código dele direto na Meta. O lead entra com o formulário "Open Bosque (Video Lucas - 2 perguntas)" e o produto Open Bosque.
3. **As 2 perguntas do formulário** aparecem no lead, pela regra que já existe.
4. **Conversões para a Meta (CAPI):** conferir se o lead novo vai enviar o evento, igual aos outros produtos.
5. Não mexo na entrada de leads da Meta, na distribuição nem em outros produtos.

## Validação
- Conferir na Meta se o formulário está ligado ao CRM (o envio de leads chega até nós).
- Fazer um teste com um lead de teste da ferramenta de testes da Meta: confirmar que ele entra como Open Bosque e vai para um corretor apto. Depois, apagar o teste.
- Se o teste não puder ser feito, aviso no primeiro lead real e confiro.

## Detalhes técnicos
- `roleta_campanhas` id `acbaa48b-…`: `ativo=true` e `segmento_id` conferido (hoje `9948f523-…`; MCMV é `5311bbbb-…`). Ajuste via run_sql.
- O código do formulário vem pela Graph API (`resolve-meta-forms` / `leadgen_forms` da página). Ele entra em `META_FORM_ID_MAP`, nos arquivos `receive-meta-lead/index.ts` e `src/lib/metaFormIdMap.ts`. Também ganha um alias em `empreendimento_aliases` para o nome completo do formulário. Exceção à regra de não tocar no `receive-meta-lead`: só uma linha no mapa. Precisa da sua aprovação.
- Deploy só de `receive-meta-lead`. Sem migration.
