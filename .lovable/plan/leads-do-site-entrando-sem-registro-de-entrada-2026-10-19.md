# Leads do site entrando sem registro de entrada

## O que aconteceu (verificado)
- A Isabelly Alves entrou pelo **site uhome.com.br**, no **Pop-up de Saída**, em 17/10 às 14:58, sem imóvel específico ("Lead geral").
- Na história dela aparecem só "Movido para Sem Contato" e "Mandei whats", da Luiza. Não existe o primeiro registro dizendo de onde ela veio.
- Isso acontece com **todo lead do site**: nos últimos 30 dias foram 11 (Botão WhatsApp, Página do Imóvel, Pop-up de Saída, Banner do Corretor, captação), e nenhum tem registro de entrada. O caminho do site cria o lead e avisa o corretor, mas não grava nada na história. Já o caminho dos anúncios da Meta grava.

## O que vou fazer
1. Todo lead novo do site passa a ter, na história, um registro de entrada igual ao dos anúncios. Exemplo: **"Lead gerado via Site — Pop-up de Saída"**, com todos os detalhes do clique que o site mandar:
   - **Onde clicou:** Pop-up de Saída, Botão WhatsApp, Página do Imóvel, Banner do Corretor etc.
   - **Página:** o endereço da página em que o cliente estava.
   - **Imóvel:** nome, código e link do imóvel (ou bairro de interesse).
   - **De onde veio:** Google, Instagram, campanha etc., quando o site mandar essa informação. Se não vier, aparece "acesso direto/orgânico".
   - Quando for um lead geral, sem imóvel, o registro deixa isso claro.
2. Quando um cliente que já existe volta pelo site, a história mostra **"🔄 Novo interesse via Site"**, com o que ele clicou. Hoje isso só vai para as observações.
3. **Correção retroativa:** criar o registro de entrada nos 11 leads do site dos últimos 30 dias, incluindo a Isabelly, com a data e a hora em que cada um entrou e os detalhes do clique que ficaram guardados. Só acrescenta o registro; não muda corretor, etapa nem nada do lead.
   - A Isabelly veio do **Pop-up de Saída**, como lead geral, sem imóvel, sem página guardada e sem campanha (orgânico). Se o site não mandou mais dados naquela vez, não tenho como recuperá-los.
4. Se o site não estiver mandando a página ou a origem em algum tipo de clique, eu te aviso qual é, para corrigir no site.

## O que não muda
Distribuição, Roleta, avisos, corretor e etapa continuam iguais.

## Como vou validar
Mando um lead de teste pelo site, confiro o registro na história no preview e depois apago o teste. Abro a Isabelly para conferir o registro retroativo.

## Detalhes técnicos
- `supabase/functions/crm-webhook/index.ts`: depois do insert (~linha 380), inserir em `pipeline_atividades` `tipo: "entrada"`, `titulo: "Lead gerado via Site — ${origem_detalhe}"`, `descricao` com imóvel/código/link/página, `created_by` sistema (`0000…0000`), e envolver em try/catch para nunca derrubar a entrada do lead. No caminho de dedup (~linha 306/322), inserir `"🔄 Novo interesse via Site"`. Deploy do `crm-webhook`.
- Backfill pelo run_sql: inserir a atividade de entrada nos leads `origem='site_uhome'` dos últimos 30 dias que ainda não têm `tipo='entrada'`, com `created_at = lead.created_at`. Sem migration.
