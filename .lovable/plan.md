# Roleta — nova regra de credenciamento alinhada às pílulas de saúde

## O que existe hoje (verificado no banco)

O bloqueio da roleta usa `contar_leads_desatualizados`, que **não tem nada a ver com a pílula vermelha**: ele conta leads ativos **sem tarefa pendente** (regra antiga de "tarefa obrigatória"). Por isso os números não batem com o que o corretor vê no pipeline. Exemplos reais de hoje:

| Corretor | Vermelhos (pílula) | Contagem da regra atual |
|---|---|---|
| Rafaela Sandin | 61 | 12 |
| Flávio Dias | 52 | 44 |
| Jéssica França | 26 | 8 |
| Rafaela Campos | 8 | 26 |
| William Brizola | 7 | 46 |
| Anderson Amaral | 4 | 27 |

Ou seja: hoje tem gente bloqueada sem estar vermelha, e gente muito vermelha passando.

Regras hoje em vigor (`get_elegibilidade_roleta`, `corretor_pode_entrar_roleta`, `credenciar_na_roleta`, `credenciar_por_alocacao`):

1. Bloqueio por "desatualizados" (sem tarefa pendente) > 10 — vale manhã, tarde e noite.
2. Bloqueio por descartes no mês ≥ 50 (com desbloqueio manual do gestor por mês).
3. Noturna: exige visita agendada/realizada hoje **e** presença marcada na manhã **E** tarde (flag `noturna_exige_manha_tarde`, hoje ligada).
4. Domingo: ≥ 2 visitas realizadas na semana **e** ≥ 4 presenças na semana.
5. Credenciamento por alocação entra como **pendente** (aprovação do CEO); o antigo `credenciar_na_roleta` auto-aprova.
6. Sem empreendimento alocado / sem segmento → não credencia.
7. Fechamento de turno automático desativa fila e marca falta.

## O que muda nesta fase

**Trocar a base de contagem**: o gate passa a contar **leads com pílula VERMELHA** (`lead_saude_status = 'vermelho'`), a mesma função que colore o pipeline. Limite: **máximo 10 vermelhos** (bloqueia a partir de 11). Vale igual para manhã, tarde e noite.

- Escopo: leads ativos do corretor (não arquivados, fora de descarte/venda/caiu/convertido) — mesmo escopo das pílulas.
- Limite continua configurável em `roleta_config.limite_leads_desatualizados` (padrão 10).
- A mensagem de bloqueio passa a dizer "Você tem X leads vermelhos (limite 10)" e a tela lista os vermelhos para atualizar.
- Noturna: **mantida** a exigência de visita agendada no dia.

## Detalhes técnicos

- Nova função `public.contar_leads_vermelhos(uuid)` usando `lead_saude_status(ultimo_toque_at, coalesce(distribuido_em, aceito_em, created_at), ps.tipo)` sobre `pipeline_leads` do escopo do corretor.
- `corretor_pode_entrar_roleta` e `get_elegibilidade_roleta` passam a usar essa contagem; `get_elegibilidade_roleta` volta a preencher `leads_para_atualizar` (hoje devolve `[]`) com os vermelhos mais antigos.
- `credenciar_na_roleta` e `credenciar_por_alocacao`: só troca o texto do erro.
- Frontend: `StatusElegibilidadeRoleta.tsx`, `RoletaStatusBar.tsx`, `OportunidadesDoDia.tsx` e `RoletaConfigTab.tsx` passam a falar "vermelhos" em vez de "sem tarefa".
- `contar_leads_desatualizados` fica no banco (usada em outros lugares) mas sai do caminho da roleta.

## Decisões que preciso fechar contigo

1. **Estagnado conta?** Leads parados há muito tempo em Sem Contato/Qualificação/Aquecimento hoje viram "estagnado" (roxo) na régua nova. Contam junto com os vermelhos no limite de 10, ou ficam de fora?
2. **Limite de descartes (50/mês)** — mantém como está?
3. **Noturna exige presença manhã + tarde?** Hoje exige. Mantém, ou passa a bastar a visita agendada no dia?
4. **Domingo (2 visitas + 4 presenças na semana)** — mantém?
5. **Aprovação do CEO** no credenciamento por alocação — mantém pendente ou vira automático quando o corretor está dentro das regras?
6. **Transição**: com a régua nova, hoje 9 corretores passariam de 10 vermelhos (Rafaela Sandin 61, Flávio 52, Gustavo 28, Bruno 26, Jéssica 26, Thalia 25, Douglas 25, Matheus 22, Paula 20). Entra valendo direto ou com prazo de limpeza (ex.: avisa hoje, bloqueia a partir de segunda)?

## Validação

Comparar, para cada corretor, a contagem nova com o número de pílulas vermelhas na tela do pipeline; abrir a Roleta como corretor bloqueado e como liberado, conferindo mensagem, lista de leads a atualizar e o credenciamento das três janelas.
