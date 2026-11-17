# Jornada do site no detalhe do lead (somente CRM)

## O que foi conferido
- O lead de teste existe como **"TESTE JORNADA 3 SESSOES"** (id `3a398a19…`), não com o id `5e94df6c…` citado no contrato (esse não existe no CRM).
- Ele tem 36 eventos únicos, mas em **8 sessões** (não 3), primeira origem Google; a última origem chegou vazia. Hoje está sem corretor, em Novo Lead.
- A ficha já tem o quadro "Veio do site" (resumo + "Ver mais"). Ele ainda não lê `jornada` nem `site_events`.

## Fase 0 — Desenho para aprovação
Antes de qualquer código, um desenho (computador e celular 390px) da nova parte "Jornada no site" dentro do quadro "Veio do site". Só seguimos depois de você aprovar.

## Fase 1 — O que aparece na ficha (organizado, sem excesso)
Dentro de "Veio do site", uma parte **Jornada no site** em 3 níveis:

```text
Resumo (sempre visível, 2 linhas)
  Google -> voltou pelo Meta · 8 visitas desde 10/11 · Pediu visita 18/11 tarde
Ver mais
  1. Origem       primeira e última (fonte + campanha); selo "Anúncio Google/Meta"
  2. Interesse    imóveis vistos com contagem (top 5) · favoritos · pedidos
                  buscas e filtros num único item "Procurou"
  3. Sessões      lista recolhida: data · duração · nº de ações (mais recente aberta)
                  dentro: horário · ação legível · imóvel ou página
```

O que **não** aparece: códigos técnicos (gclid, ids, visitor_id), rolagem 50%, fotos abertas e páginas repetidas seguidas (viram "viu 3 páginas"). Sem dado, a linha some. Leads antigos sem jornada: a parte não aparece.

## Regras de leitura
- Usa **só uma** lista: `dados_site.jornada.site_events` (se faltar, `dados_site.site_events`). Remove repetidos pelo `event_id`.
- Ignora eventos marcados como robô.
- Aliases antigos (imovel_visualizado, busca_realizada, whatsapp_click, galeria_aberta, formulario_enviado) viram o nome novo e não contam de novo se o evento novo equivalente já existir na mesma sessão no mesmo minuto.
- Corta eventos com mais de 90 dias.
- Só leitura: não muda corretor, etapa, dados do lead, conversões do Google Ads nem cria outro canal. Retornos já chegam no mesmo lead pela integração atual.

## Atualização ao vivo
A ficha aberta escuta mudanças daquele lead e recarrega a jornada quando chegar evento novo (com recarga ao voltar para a aba como reserva).

## Validação
- Testes das regras (dedupe por event_id, robô fora, alias, 90 dias, agrupamento por sessão).
- Abrir o lead de teste no computador e no celular 390px, conferir histórico e sessões.
- Adicionar um evento de teste no lead (só no `dados_site` dele), ver a ficha atualizar sozinha, conferir que continua **um único lead** e remover o evento de teste.

## Técnico
- Novo `src/lib/siteJornada.ts` (leitura pura + testes) e `src/components/pipeline/drawer/JornadaSite.tsx`; `VeioDoSite.tsx` passa a usar o componente e uma assinatura em tempo real filtrada por `id`.
- Se `pipeline_leads` não estiver habilitada para tempo real, usar recarga periódica leve enquanto a ficha estiver aberta, sem mudar o banco.
