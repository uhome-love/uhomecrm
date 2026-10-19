# Leads do site entrando sem registro de entrada

## O que aconteceu (verificado)
- A Isabelly Alves entrou pelo **site uhome.com.br**, no **Pop-up de Saída**, em 17/10 às 14:58, sem imóvel específico ("Lead geral").
- Na história dela aparecem só "Movido para Sem Contato" e "Mandei whats", da Luiza. Não existe o primeiro registro dizendo de onde ela veio.
- Isso acontece com **todo lead do site**: nos últimos 30 dias foram 11 (Botão WhatsApp, Página do Imóvel, Pop-up de Saída, Banner do Corretor, captação), e nenhum tem registro de entrada. O caminho do site cria o lead e avisa o corretor, mas não grava nada na história. Já o caminho dos anúncios da Meta grava.

## O que vou fazer
1. Todo lead novo do site passa a ter, na história, um registro de entrada igual ao dos anúncios. Exemplo: **"Lead gerado via Site — Pop-up de Saída"**, com o imóvel, o link e a página quando vierem.
2. Quando um cliente que já existe volta pelo site, a história mostra **"🔄 Novo interesse via Site"**, com o que ele clicou. Hoje isso só vai para as observações.
3. **Correção retroativa:** criar o registro de entrada nos 11 leads do site dos últimos 30 dias, incluindo a Isabelly, com a data e a hora em que cada um entrou. Só acrescenta o registro; não muda corretor, etapa nem nada do lead.

## O que não muda
Distribuição, Roleta, avisos, corretor e etapa continuam iguais.

## Como vou validar
Mando um lead de teste pelo site, confiro o registro na história no preview e depois apago o teste. Abro a Isabelly para conferir o registro retroativo.

## Detalhes técnicos
- `supabase/functions/crm-webhook/index.ts`: depois do insert (~linha 380), inserir em `pipeline_atividades` `tipo: "entrada"`, `titulo: "Lead gerado via Site — ${origem_detalhe}"`, `descricao` com imóvel/código/link/página, `created_by` sistema (`0000…0000`), e envolver em try/catch para nunca derrubar a entrada do lead. No caminho de dedup (~linha 306/322), inserir `"🔄 Novo interesse via Site"`. Deploy do `crm-webhook`.
- Backfill pelo run_sql: inserir a atividade de entrada nos leads `origem='site_uhome'` dos últimos 30 dias que ainda não têm `tipo='entrada'`, com `created_at = lead.created_at`. Sem migration.
