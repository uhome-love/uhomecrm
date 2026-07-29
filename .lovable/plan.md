# Fase B — Ocultar PII do lead até o corretor aceitar

Adição à correção de notificações de aceite (Fase A já planejada).

## Problema

Hoje, no pop-up de aceite (roleta), o corretor já vê **nome + telefone + email + observações** antes de clicar em "Aceitar". Isso permite que ele "salve" o contato no celular ou fale com o lead por fora antes de aceitar oficialmente pela roleta — burlando SLA, distribuição e histórico.

## Comportamento desejado

Antes de aceitar:
- Mostrar apenas: **primeiro nome**, empreendimento, origem/campanha, prioridade e o timer.
- Telefone, email e observações ficam **mascarados** (ex.: `📞 •• ••••• ••••` / `✉️ •••@•••`).

Depois de aceitar (clique em "Aceitar Lead" com sucesso do backend):
- Mesma tela revela todos os dados completos por 3-4s antes de fechar, OU o pipeline abre normalmente com o lead (comportamento atual).

Rejeitar continua igual — sem revelar dados.

## Superfícies afetadas (só frontend, 3 arquivos)

1. **`src/components/pipeline/LeadAcceptanceDialog.tsx`** (popup principal da roleta)
   - Substituir bloco "Lead info" (linhas 136-162): mostrar só primeiro nome + empreendimento + origem + prioridade. Telefone/email/observações renderizados com máscara.
   - Adicionar pequeno aviso: *"Dados de contato liberados após aceitar."*
   - Após `handleAccept` bem-sucedido: opcionalmente revelar dados completos por 3s antes do `onClose()` (a definir com o Lucas — pode simplesmente fechar como hoje, já que o corretor cai no pipeline com o lead aberto).

2. **`src/pages/AceiteLeads.tsx`** (página `/aceite-leads` — versão dedicada quando há vários leads)
   - Linhas 205-206 e 578-581: aplicar mesma máscara para leads ainda **pendentes** de aceite (`aceite_status !== 'aceito'`).
   - Leads já aceitos (bloco linhas 528+ "Aceitos hoje") continuam mostrando telefone normalmente.

3. **`src/components/notifications/NewLeadBanner.tsx`** (banner de canto superior via realtime)
   - Não mostra telefone/email atualmente (só nome), mas conferir que o payload `newRow.telefone` (linha 82) não é exibido em lugar nenhum acessório.

## Fora de escopo

- Backend/RPC/RLS: **nada muda**. `distribuir_lead_atomico` continua retornando o registro completo — a ocultação é puramente de apresentação. Isso mantém o "reveal" após aceite instantâneo, sem round-trip extra.
- Push notification e WhatsApp de alerta: já mandam só o nome, sem alteração.
- Pipeline / detalhe do lead: sem mudança — só entra ali quem já aceitou.

## Helper compartilhado

Criar `src/lib/leadMask.ts` com:
- `maskPhone(t: string | null)` → `"(51) ••••• ••••"` preservando DDD.
- `maskEmail(e: string | null)` → `"j•••@g•••.com"` preservando primeira letra + domínio truncado.
- `firstName(n: string)` → primeiro token do nome.

Usado nos 2 componentes acima para consistência.

## Ordem de execução (integrada à Fase A)

1. Mockup dos 2 estados (mascarado / revelado) do `LeadAcceptanceDialog` → aprovação do Lucas.
2. Build da Fase A (thresholds de notificação) + Fase B (máscara) no mesmo ciclo, pois ambas mexem no fluxo de aceite.
3. Validação ao vivo com lead sintético: abrir o pop-up e confirmar que telefone/email aparecem mascarados; clicar "Aceitar" e confirmar liberação dos dados no pipeline.
