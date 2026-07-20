
# Revisão das Regras de Presença

Ajustes de comportamento após validação ao vivo. Nada de novo módulo — só refino do que já está no ar em `/roleta/presenca`.

## 1. Falta deixa de ser automática

Hoje o cron `01:00 BRT` marca `faltou` para quem não tem registro. Isso vai sair.

- **Regra nova:** o gerente marca explicitamente **Presente** OU **Faltou** por corretor/turno. Sem marcação = **Sem marcar** (cinza), não conta como falta.
- Adicionar botão **Faltou** ao lado de **Presente** para corretores não credenciados (credenciados continuam só com **Saiu**, já que estão auto-presentes).
- Desativar o cron/job que marcava falta automaticamente.
- No histórico e estatísticas: **falta = registro explícito de `faltou`**. "Sem marcar" fica separado, não polui contadores de assiduidade.

## 2. Janela de registro = o dia todo (não por turno)

Hoje, se passou o turno, o gerente não consegue mais marcar. Vai virar:

- Gerente pode registrar/editar presença de **qualquer turno do dia até 23:59 BRT** do mesmo dia.
- Depois de virar o dia, trava (edição vira auditoria manual).
- **Lembrete diário** no dashboard do gerente: banner persistente enquanto houver corretor da equipe em "Sem marcar" no dia — mensagem clara "Você tem X corretores sem marcação hoje. Finalize antes de encerrar o dia."
- Um push/notification opcional às 18h para o gerente se ainda tiver pendências (fase 2, não bloqueante).

## 3. Regras por dia da semana

A lógica de "quais turnos existem" muda por dia. Hoje está fixo Manhã/Tarde/Noturna todos os dias.

### Segunda a Sexta (presencial — como está hoje)
- Turnos ativos: **Manhã** e **Tarde** (presencial na imobiliária).
- **Noturna**: NÃO é turno de presença física. Quem está credenciado e ativo na roleta noturna aparece como "Presente – Noturna (de casa)" automaticamente. Sem botão de marcar/faltar para noturna.
- Gerente valida só Manhã e Tarde.

### Sábado
- Não há presença na imobiliária.
- **Presença conta se:** o corretor (a) está credenciado na roleta do sábado, OU (b) tem visita/plantão registrado no dia.
- Quem não se encaixa em (a) nem (b) = **Falta** (mas ainda assim é registro automático baseado em dado, não cron cego — se não houver visita nem roleta, marca falta ao fim do dia).
- Gerente pode sobrescrever manualmente (justificar presença) se for o caso.

### Domingo
- Roleta 100% de casa.
- **Presente = tem benefício ativo de roleta de domingo** (credenciado + aprovado).
- Sem botões manuais nesse dia — é derivado da roleta.
- Quem não está na roleta de domingo: não aparece na página (não é dia útil pra ele).

## 4. Ajustes de UI na página `/roleta/presenca`

- Cabeçalho do dia mostra qual regime está ativo: "Seg-Sex presencial", "Sábado híbrido", "Domingo remoto".
- Colunas de turno se adaptam:
  - Seg-Sex: **Manhã | Tarde | Noturna (auto)**
  - Sábado: **Roleta/Visita/Plantão** (coluna única derivada)
  - Domingo: **Roleta Domingo** (coluna única derivada)
- Botões por corretor não credenciado (Seg-Sex, turnos Manhã/Tarde): **Presente** · **Faltou** · **Saiu** (Saiu só após Presente).
- Banner de lembrete do gerente aparece o dia todo enquanto tiver pendência.

## 5. Backfill e limpeza

- Reverter as `faltou` automáticas de dias passados criadas pelo cron nos últimos 7 dias, transformando em "Sem marcar" (pra não penalizar corretor por falha de gerente que na regra nova não existiria).
- Recalcular estatísticas do histórico com a nova definição de falta.

## Detalhes técnicos

- Desabilitar cron `marcar_faltas_automaticas` (ou equivalente); manter apenas jobs de auto-presença por credenciamento.
- `derivarEstadoTurno` em `src/lib/roletaPresenca.ts` passa a receber `diaSemana` e aplicar regime (util-week / saturday / sunday).
- Novo helper `getRegimeDoDia(date)` retorna `{ turnosAtivos, fonteDePresenca, permiteMarcacaoManual }`.
- `PresencaRoletaPanel.tsx`: renderização condicional das colunas e botões baseada em `regime`.
- `RegistrarHorarioDialog.tsx`: adicionar variante "Faltou" (motivo opcional).
- `usePresencaCorretoresDia.ts`: para sábado, cruzar com `visitas` do dia e `roleta_credenciamentos` para derivar presença; para domingo, só credenciamentos aprovados de domingo.
- Trigger `trg_presenca_auto_credenciamento`: incluir roleta noturna (seg-sex) e roleta domingo como fontes automáticas.
- Migration: remover job de auto-falta; backfill dos últimos 7 dias.

## Fora do escopo desta fase

- Notificações push proativas ao gerente (fica pra fase seguinte se ele quiser).
- Relatório de assiduidade agregado com a nova definição (posso incluir depois se pedir).
