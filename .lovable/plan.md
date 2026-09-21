# Disparo para o Pipeline Ativo — resposta avisa o corretor, sem trocar de dono

## O que já funciona hoje (verificado no código)

- A Central de Reengajamento já permite escolher o público **"Pipeline ativo"** (por etapas).
- Quando o disparo foi feito para esse público e o cliente clica **"Sim"**, o sistema já:
  - NÃO manda para a roleta nem para a Fila do CEO;
  - mantém o mesmo corretor;
  - registra a resposta na linha do tempo do lead;
  - cria um aviso para o corretor dono, que vira pop-up na tela dele em tempo real.

Ou seja, a regra principal que você pediu já está de pé. O que falta são três buracos.

## Os três buracos a corrigir

1. **Resposta "Não" arquiva o lead do corretor.**
   Hoje, qualquer "Não" descarta o lead em definitivo e o arquiva — mesmo vindo de um cliente
   ativo no funil de alguém. Para o público Pipeline ativo isso passa a **não acontecer**:
   o lead continua com o corretor, na mesma etapa, e o corretor recebe um aviso de que o
   cliente respondeu "Não" agora, para ele decidir o que fazer.

2. **Resposta escrita à mão pode não ser reconhecida.**
   Se o cliente responder algo positivo com outras palavras ("tenho interesse", "me chama"),
   hoje o sistema só grava o status e ninguém é avisado. Passa a avisar o corretor sempre
   que a resposta indicar interesse — clique no "Sim" ou texto positivo.
   Texto neutro/negativo continua só registrado na linha do tempo, sem pop-up (conforme sua escolha).

3. **Resposta que chega "solta" (sem casar com o disparo).**
   Quando o WhatsApp não devolve a referência da mensagem original, a resposta cai num
   caminho alternativo que hoje nunca avisa o corretor. Passa a avisar quando esse contato
   tiver recebido um disparo de Pipeline ativo nas últimas 72h.

Em todos os casos: **nunca** entra roleta, **nunca** troca de corretor, **nunca** muda a etapa.

## Como o corretor vê

Pop-up na tela, na hora, com o nome do cliente, o que ele respondeu e um botão "Abrir" que
leva direto ao lead. Se ele estiver com a aba fechada, recebe a notificação do navegador.
Fica também no sininho de notificações e na linha do tempo do lead.

## Validação ao vivo (sem disparar nada)

- Simular uma resposta "Sim" e uma resposta "Não" de um lead de teste que esteja no pipeline,
  e conferir: lead continua com o mesmo corretor, mesma etapa, não aparece na Fila do CEO,
  e o aviso aparece para o corretor dono.

## Detalhes técnicos

- `supabase/functions/whatsapp-webhook/index.ts`:
  - No bloco de roteamento por `audience_source` (`pipeline_ativo` / `visita_amanha`):
    tratar `buttonResp === "nao"` **antes** do bloco de inativação atual, com um caminho
    próprio que só grava `reengajamento_status`, insere atividade e notifica o corretor —
    sem `tipo_descarte`, `stage_id` de descarte nem `arquivado`.
  - Ampliar a detecção de interesse em texto livre reaproveitando `isPositiveIntent`
    para o caminho `justNotifyCorretor`.
  - Em `handleUnknownReply`, antes do retorno silencioso do lead existente: checar
    `reengajamento_meta_disparos` por telefone com `audience_source = 'pipeline_ativo'`
    nas últimas 72h e, havendo intenção positiva, notificar o corretor dono.
- Notificação: `notifications` com `tipo: "lead_reengajado"`, `dados.route = "pipeline_ativo_keep"`
  — o pop-up já é renderizado por `useNotifications.ts` via realtime.
- Sem migration, sem mudança de RLS, sem alteração no motor de disparo nem na UI da Central.
- Deploy: apenas `whatsapp-webhook`.
