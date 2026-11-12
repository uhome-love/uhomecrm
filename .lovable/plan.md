# Atividade no site na ficha do lead

## O que o corretor vai ver
- Nova aba **"Atividade no site"** na ficha do lead, que **só aparece quando o lead tem atividade no site**.
- Layout limpo e organizado, com largura contida (sem esticar demais em telas grandes) e adaptado ao celular.
- No topo, um resumo: imóveis mais vistos, bairros, buscas feitas e última visita.
- Selo de temperatura do site: **Esquentando** quando voltou várias vezes, viu o mesmo imóvel mais de uma vez ou clicou no WhatsApp; senão **Navegando**.
- Abaixo, linha do tempo com cada evento: viu imóvel, buscou na IA, clicou contato, enviou formulário e o histórico enviado pelo site.
- Quando um lead em **descarte ou inativo** volta ao site: aviso no sino "Lead voltou ao site" para o corretor responsável (ou Fila do CEO se não tiver corretor), com os imóveis que ele viu.

## Regra importante (mudança de comportamento)
Hoje o recebimento de eventos **move sozinho** o lead descartado de volta para uma etapa ativa quando ele navega bastante. Pelo pedido, isso será **desligado**: o lead nunca muda de etapa, corretor ou situação por causa do site. Só aviso.

## Ordem (padrão do projeto)
1. Mockup da aba (computador + celular) para aprovação do Lucas.
2. Construção após aprovação.
3. Teste com lead de teste (enviar eventos falsos, ver aba e aviso), desktop e 390px, depois apagar os dados de teste.

## Detalhes técnicos
- `site-events`: tratar `historico_site` — localizar lead pela identidade (mesma busca por telefone/email já existente) e salvar `dados.resumo` e `dados.linha_do_tempo` em colunas novas no lead (`site_resumo jsonb`, `site_linha_do_tempo jsonb`, `site_atualizado_em`), via migration aditiva (fora do horário de pico, regra de 2/dia).
- Remover a chamada `reativarLead` do Radar; manter score e alerta de lead quente.
- Alerta "voltou ao site": quando o lead está em descarte ou arquivado/inativo, criar notificação com dedup diário por lead (`agrupamento_key`), listando até 5 imóveis vistos nas últimas 24h; sem corretor → notificação para a Fila do CEO (admins).
- Aba: novo componente em `src/components/pipeline/drawer/` lendo `site_events` do `pipeline_lead_id` (eventos visitou_imovel, buscou_ia, clicou_contato, formulario_enviado, historico_site) + o resumo salvo; temperatura calculada numa função pura com teste unitário (regras: ≥3 visitas em dias diferentes, mesmo imóvel ≥2x, clique no WhatsApp).
- Verificar se `site_events` permite leitura para quem acessa o lead (`can_access_lead`); se não, criar leitura segura pelo servidor.
- Observação: `site-events` é pública (o site chama sem login); o pedido não muda isso.
