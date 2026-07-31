# Aviso de novo lead: 100% Meta, sem o WhatsApp de clientes

O aviso de novo lead é interno (para corretores) e sai pelo **template da Meta** `novo_leaduhome`, que já está aprovado. O número de nutrição (Evolution) é o WhatsApp que fala com clientes e não deve ter nenhuma participação nesse aviso.

## Situação atual

- O aviso tenta primeiro o template da Meta (correto).
- Se o template falhar, hoje ele cai para a instância Evolution de nutrição (`uhome-nutricao`) — número de cliente. É isso que precisa sair.

## O que muda

1. **Remover completamente o fallback Evolution/nutrição** do aviso de novo lead.
2. O aviso passa a ter apenas os canais Meta:
   - template aprovado `novo_leaduhome` (nome + empreendimento, sem telefone/e-mail);
   - se o template falhar, texto livre pela própria Meta (funciona dentro da janela de 24h).
3. Se ambos falharem, o erro é registrado no painel de saúde — sem tentar nenhum outro número.

## Detalhes técnicos

- `supabase/functions/whatsapp-notificacao/index.ts`:
  - remover o helper `enviarViaEvolution`, a leitura de `reengajamento_config.evolution_instance` e a etapa de fallback Evolution;
  - manter a ordem: template Meta → texto livre Meta;
  - `ops_events` passa a registrar apenas os canais `meta` e `meta_text`.
- Sem migration, sem mudanças em reengajamento, nutrição ou campanhas.

## Validação

- Disparo de teste do aviso de novo lead: deve sair como canal `meta` (template aprovado).
- Conferir em `ops_events` que nenhum evento do aviso usa canal `evolution`.
