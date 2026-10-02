# Lembrete de credenciamento na roleta

## Ideia
30 minutos antes de fechar o credenciamento, o corretor que **ainda não se credenciou** recebe um aviso que pergunta, sem afirmar que ele está na empresa:

> "Está na empresa, em visita ou no plantão? O credenciamento da roleta da tarde fecha às 13:30. Não esquece de se credenciar!" [Credenciar agora]

Quem está de folga ou fora simplesmente ignora. O aviso não credencia ninguém sozinho: o corretor continua tendo que tocar no botão, e as regras de hoje (presença, visita para a noturna, limite de vermelhos/descartes) continuam valendo.

## Quando dispara (horários atuais da roleta)

```text
Turno     Credenciamento fecha   Lembrete
Manhã     09:30                  09:00
Tarde     13:30                  13:00
Noturna   21:30                  21:00
```
Seg a sáb. Domingo/feriado (dia todo até 23:30) fica de fora nesta primeira fase.

## Quem recebe
- Corretor ativo que **não** está credenciado naquele turno.
- **Não** recebe: quem já se credenciou, quem o gestor marcou como "Faltou" no dia e quem está bloqueado para aquele turno (para não mandar se credenciar quem não consegue).
- No máximo 1 lembrete por turno por corretor.

## Por onde chega
- Sininho do CRM + notificação no celular (push), com o botão levando direto para a tela da roleta.
- WhatsApp fica de fora (custo por mensagem e risco de spam na Meta). Se quiser, entra numa fase 2.

## Fases (seguindo o padrão: mockup, plano, build, validação)
1. Mockup do aviso (sininho e celular) para você aprovar.
2. Build do envio nos 3 horários.
3. Validação ao vivo com um corretor de teste: sem credencial recebe; credenciado não recebe; repetição não manda 2x.

## Detalhes técnicos
- Uma nova função agendada `roleta-lembrete-credenciamento` (pg_cron 3x/dia em dias úteis+sábado: 12:00, 16:00 e 00:00 UTC), protegida pelo segredo de cron igual a `roleta-fechamento-dia`.
- Lista corretores ativos sem linha em `roleta_credenciamentos` para a data/janela, exclui `roleta_presencas.status='falta'` e bloqueados via `roleta_motivo_bloqueio`.
- Cria aviso com `criar_notificacao` (tipo `lembrete_credenciamento`, dedup por corretor+data+janela via `check_notification_dedup`) e envia push pelas inscrições existentes.
- Nada muda em distribuição, roleta, pipeline ou credenciamento.
