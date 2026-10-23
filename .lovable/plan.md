# Visita em parceria conta 0,5 na Roleta (versão final)

## Regras confirmadas
- Visita é parceria quando o cliente tem parceria ativa com outro corretor — vale independente de quando a parceria foi registrada (antes ou depois da visita).
- Visita em parceria: 0,5 para o dono da parceria e 0,5 para o parceiro. Sem parceria: 1 para quem fez.
- Mesmo cliente com várias visitas na mesma semana conta 1 só.
- Cliente com mais de uma parceria (caso Isis): vale a parceria em que o corretor da visita participa e criada mais perto da data da visita (Isis 13/10 = Marcos + Douglas).
- Parceria com o mesmo corretor dos dois lados (3 antigas de março) é ignorada.
- Meta continua 2; vale em todas as janelas (semana anterior, atual, domingo); noite aceita visita do dia em parceria.
- Desfazer/excluir/alterar parceria: somente administrador (CEO). Gerente e corretor não podem mais.

## Etapas
1. Contador da Roleta com as regras acima, mostrando decimal ("1,5 de 2") nos requisitos, bloqueio e cartão do Início.
2. Travar parceria: só administrador pode cancelar, excluir ou mudar a divisão; esconder esses botões para os demais.
3. Formulário da visita: ao editar, mostrar parceria existente e permitir adicionar parceria também na edição; não deixar escolher o próprio corretor.
4. Conferência final 1 a 1 dos 8 casos (Jocarli, Cesar x2, Rodrigo, João Neto, Isis) e comparação antes/depois por corretor; validar com cliente de teste (criar, editar com parceria, marcar realizada, ver contador dos dois, tentar desfazer como não-admin) e apagar o teste.

## Detalhes técnicos
- Migration: `roleta_visitas_realizadas_periodo` vira numeric — agrupa por cliente distinto no período; peso 0.5 se existir `pipeline_parcerias` ativa no lead com principal≠parceiro envolvendo o corretor (como principal, parceiro ou dono da visita), 1 caso contrário; resolve ids auth/profile. Ajustar `roleta_apto_janela`, `roleta_motivo_bloqueio` (numeric, formato com vírgula) e `roleta_tem_visita_hoje`.
- Mesma migration: políticas UPDATE/DELETE de `pipeline_parcerias` passam a exigir `has_role(auth.uid(),'admin')` (hoje são de gestores).
- `useParcerias.ts`/telas de parceria: ações de desfazer só para admin. `VisitaForm.tsx`: carregar e gravar parceria no modo edição.
- `useRoletaRequisitos`/`useRoletaPerformanceStatus`: exibir decimal. Teste unitário da regra de peso e de 1 por cliente na semana.
