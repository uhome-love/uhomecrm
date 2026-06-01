# Correções nos relatórios de maio/2026

Investiguei os dados e encontrei a causa dos números errados.

## O problema

**Roleta diurna/noturna estava contando LEADS distribuídos, não TURNOS.**
O script usa `roleta_distribuicoes` (cada linha = 1 lead que caiu na roleta). Por isso números como 46 noturnas / 74 diurnas — são leads recebidos, não plantões. A fonte correta para "quantas roletas o corretor fez" é `roleta_credenciamentos` (1 linha = corretor credenciado naquele dia/turno).

Exemplo real (Junior Padilha, maio):
```text
manhã:     14 dias
tarde:     18 dias
noturna:   13 dias   (≤ 31 ✓)
dia_todo:   5 dias   (domingos / benefício)
```

## O que vou corrigir

### 1. Roleta: separar diurna, noturna e dia todo (fonte = credenciamentos)
- **Diurna** = nº de turnos de manhã + nº de turnos de tarde.
- **Noturna** = nº de dias credenciado na janela `noturna` (máx. 31).
- **Dia todo (Domingo / benefício)** = nº de dias na janela `dia_todo`, exibido como informação separada e clara (é a roleta de domingo, benefício do corretor).
- Trocar a query `data["roletas"]` para usar `roleta_credenciamentos` em vez de `roleta_distribuicoes`, devolvendo `diurna`, `noturna` e `dia_todo` separados.

### 2. Visitas realizadas (apenas as que aconteceram)
- A lista detalhada e o KPI "visitas realizadas" passam a considerar **somente `status = 'realizada'`** (exclui `no_show` e `marcada`).
- Manter "visitas criadas" como total (todos os status) para comparação.
- Conferido em maio: 139 realizadas, 163 no_show, 36 marcadas.

### 3. Origem + Campanha
- Hoje o relatório mostra só a origem. Vou adicionar a **campanha** ao lado, na mesma seção, mostrando origem e campanha por corretor (volume e melhor aproveitamento).

## Fluxo
1. Ajustar `/tmp/fetch_data.py` (queries de roleta, visitas, campanha) e `/tmp/gen_reports.py` (seção roleta com 3 blocos e seção origem+campanha).
2. Regerar o **modelo do Junior Padilha**, converter em imagem e validar visualmente (QA).
3. Te mostrar o modelo corrigido para aprovação.
4. Após o OK, regerar os **28 relatórios + o ZIP** (mantendo os ajustes manuais de Thalia, Gustavo e Rafaela).

## Detalhe técnico
- `data["roletas"]` sobre `roleta_credenciamentos` no período:
  `COUNT(*) FILTER (janela='manha') + COUNT(*) FILTER (janela='tarde') AS diurna`,
  `COUNT(*) FILTER (janela='noturna') AS noturna`,
  `COUNT(*) FILTER (janela='dia_todo') AS dia_todo`.
- Visitas: reforçar `status='realizada'` em `visitas` (KPI realizadas) e `visitas_detalhe`.
- Campanha: nova query agregando `pipeline_leads.campanha` por corretor; render na página de origens.
