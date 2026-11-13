# Bloqueio de tela: lead do corretor respondeu "sim" ao reengajamento

## O que já existe
Quando um lead que está no Pipeline com corretor responde "sim" a um disparo, o corretor já recebe aviso no sino e push ("🔥 Fulano respondeu SIM ao disparo"). O lead continua com ele.

## O que muda
- Além do sino e do push, a tela do corretor fica bloqueada com uma janela:
  "🔥 Seu lead Fulano respondeu SIM ao disparo de reengajamento — entre em contato agora", com o empreendimento, a resposta do cliente e o horário.
- Botões: **Ligar agora** (abre o discador no celular) e **WhatsApp**. Os dois abrem a ficha do lead e liberam a tela. Basta confirmar ciente; não precisa registrar o contato.
- Se houver mais de um, aparece um por vez ("1 de 3").
- Vale em qualquer página, no computador e no celular. Aparece também quando o corretor abre o CRM depois (se estava fechado, o push chega e ao abrir a tela bloqueia).
- O gerente não é avisado. Leads sem corretor continuam indo para a Fila do CEO como hoje.
- Nada muda na etapa, no corretor ou na distribuição do lead.

## Ordem (padrão Uhome)
1. Mockup computador + celular para aprovação.
2. Construção.
3. Teste com lead de teste, computador e 390px.

## Detalhes técnicos
- Fonte: `notifications` com `tipo='lead_reengajado'` e `dados.route='pipeline_ativo_keep'` (já gravada em `whatsapp-webhook`). Sem migration se `notifications` tiver `lida`/`read_at`; o bloqueio mostra as não confirmadas das últimas 48h.
- Confirmar = marcar a notificação como lida (própria do usuário, RLS atual) + navegar para `/pipeline-leads?lead=<id>`; no celular, "Ligar" usa `tel:`.
- Novo componente `ReengajamentoInteresseBloqueio.tsx` montado no `AppLayout` ao lado do `VisitaPendenteBloqueio` (visita pendente tem prioridade se as duas existirem). Atualiza por realtime em `notifications` do próprio usuário + ao focar a janela.
- Regra no `AGENTS.md`: bloqueio só informa e libera com ciência; nunca altera o lead.
