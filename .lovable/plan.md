# Jornada no site — fase 2 (aviso, mídia, acesso)

## O que já existe (não muda)
- A caixa "Jornada no site" na ficha do lead já lê `dados_site.jornada` (resumo recolhido + "Ver mais" com Origem, Interesse e Sessões dos últimos 90 dias), sem duplicar eventos e sem robôs. Lead sem jornada: a caixa não aparece.

## Ajustes na caixa (só visual, mesmo desenho aprovado)
- Acrescentar no resumo: tempo entre a primeira visita e o pedido; bairros, tipos e faixa de valor das buscas; favoritos.
- Pedido: visita com dia e período, ou informações com assunto e planta.
- Sessões continuam mais nova em cima, ao lado da linha do tempo do lead.

## Aviso "voltou ao site"
- Quando a jornada do lead chegar com evento novo (de verdade, não alias antigo) depois da criação do lead, o corretor dono recebe aviso no sino + push (mesmo canal atual).
- Máximo 1 aviso por hora por lead. Lead sem corretor não gera aviso.
- Não toca em etapa, corretor, roleta nem distribuição.

## Relatório de mídia
- Na base do relatório de custo por visita, acrescentar: visitas no site, primeira origem, última origem, imóveis vistos e pedido no site, lidos da jornada.

## Quem vê
- Só o corretor dono e gestores (gerente da equipe, diretora, CEO). Nada aparece para o cliente.

## Lead de teste
- O lead indicado (3a398a19…) não foi encontrado no banco hoje — pode ter sido apagado. Vou pedir ao site um novo envio de teste, garantir que fique sem corretor e fora dos relatórios, validar a caixa com ele e depois arquivar (sem apagar).

## Entrega
- Print da caixa aberta no lead de teste (computador e celular 390px), print do aviso chegando a um corretor de teste e confirmação do arquivamento.

## Detalhes técnicos
- Gatilho AFTER UPDATE OF dados_site em pipeline_leads: compara maior `quando` não-alias de `jornada.site_events` com o anterior e com `created_at`; chama `criar_notificacao` com agrupamento_key `site_volta:{lead}:{hora}`; EXCEPTION WHEN OTHERS (nunca derruba a entrada).
- Colunas novas em midia_lead_jornada (nullable) + preenchimento no ponto que já monta a tabela.
- Leitura da jornada no frontend respeita o RLS atual de pipeline_leads (dono/gestor); sem novo acesso público.
- 1 migration, fora do horário de pico se possível. Teste SQL para o limite de 1 aviso/hora.
