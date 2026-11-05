# Passo 2 — Dossiê do lead + memória do lead + bateria de testes de dado

Somente leitura dos dados do CRM. Nada muda em etapa, corretor, tarefa ou distribuição. Nenhuma tela nova para o corretor neste passo.

## 1. O que o dossiê junta (por lead, só se o corretor pode ver o lead)

| Bloco | Fonte | Como liga | Regra |
|---|---|---|---|
| Ficha e etapa | `pipeline_leads` + `pipeline_stages` | id | nome, produto, etapa, temperatura, substatus, saúde e dias sem toque pela mesma régua de `leadSaude.ts` (relógio do ciclo atual) |
| Qualificação | `form_respostas`, `objetivo_cliente`, `faixa_valor`, `prazo_decisao`, `forma_pagamento`, `radar_*`, `campanha`, `anuncio`, `formulario` | id | campo vazio vira "lacuna", nunca é inventado |
| Timeline inteira | `pipeline_atividades` | pipeline_lead_id | contagem por tipo + primeira/última data + marcos (entrada, estagnação, repasse) |
| Atividades recentes | `pipeline_atividades` | pipeline_lead_id | as 8 mais recentes na íntegra |
| Anotações | `pipeline_anotacoes` | pipeline_lead_id | fixadas primeiro, depois as 5 mais recentes na íntegra |
| Lia | `lia_estado` | **lead_id** | status, nível, resumo, qualificado/repassado em, produto, opt-out |
| Conversa da Lia | `lia_conversas` | telefone normalizado | só contagem + datas + últimas 3 falas do cliente, resumidas |
| Respostas a disparos | `whatsapp_respostas` | telefone normalizado | campanha, data, resposta |
| Ligações da Oferta Ativa | `oferta_ativa_tentativas` → `oferta_ativa_leads` | telefone normalizado | resultado, feedback, data |
| Visitas, tarefas, negócio, parceria | tabelas atuais | pipeline_lead_id | próxima visita, faltas, tarefas atrasadas, fase do negócio |
| Memória | `homi_memoria_lead` | lead_id | fatos confirmados pelo corretor |

Cada fato sai com **data, fonte e ciclo** (atual / anterior). O que for de ciclo anterior ou de outro corretor vem marcado.

## 2. Telefone normalizado (uma regra só)
Hoje os formatos variam: Lia 10–13 dígitos, disparos 11–13, Pipeline com lixo (1 a 30 caracteres). Regra: tirar tudo que não é número, tirar o 55 do início quando sobrar 12–13, chave = **DDD + últimos 8 dígitos** (ignora o 9º dígito). Telefone com menos de 10 dígitos não liga nada (vira lacuna). Se a chave bater em mais de um lead ativo, não junta (evita misturar clientes).

## 3. Memória do lead (`homi_memoria_lead`, hoje 0 linhas)
- Problema encontrado: a chave única é (lead, assunto), mas a regra de acesso é "só o próprio usuário". Em parceria, o segundo corretor não vê nem consegue gravar o mesmo assunto. Ajuste: chave única passa a ser (lead, usuário, assunto); leitura para quem pode ver o lead; escrita só do próprio usuário.
- Só grava após o corretor confirmar (prévia). Proibido: CPF, renda, documento, telefone, e-mail.
- Assuntos fixos: decisor, objeção, prazo, orçamento, preferência, observação.

## 4. Onde roda
Uma função do banco de leitura (`homi_dossie_lead(lead_id)`), que roda com as permissões do corretor logado e confere `can_access_lead` antes de tudo. A função `homi-chat` passa a usá-la no lugar de `readLeadHistory()` e manda para a IA só o resumo. Nada de chave fixa, nada de acesso anônimo, sem chamadas para fora.

## 5. Bateria de testes de dado (arquivo 10)
- 8 leads reais de um corretor de teste: no-show, visita amanhã, pós-visita com objeção, veio da Lia, Sem Contato, respondeu disparo, com negócio, com parceria.
- Para cada um, o "esperado" é tirado do banco por consulta direta e comparado com o dossiê (campo a campo), não com outra IA.
- Testes de segurança: corretor sem acesso recebe recusa; telefone que bate em 2 leads não junta; dossiê não traz CPF/renda/documento; texto de anexo/conversa com "ignore as regras" fica como dado.
- Meta: 100% nos testes de dado e segurança antes de ligar no HOMI.

## 6. Exemplo real anonimizado (lead em Qualificação, Casa Tua)
```json
{
  "lead": {"id": "adff…f23", "nome": "G***", "produto": "Casa Tua Porto Alegre", "etapa": "Qualificação",
           "temperatura": "morno", "ultimo_toque": "2026-11-03", "ciclo_atual_desde": "2026-10-20"},
  "perfil": {"origem": "Instagram — anúncio 'Vídeo Tour 2D 509 mil'", "pediu": "casa 3 dorm. 130 m²",
             "objetivo": null, "faixa_valor": null, "prazo": null, "pagamento": null},
  "timeline_resumo": {"total": 17, "por_tipo": {"whatsapp": 13, "entrada": 2, "sistema": 2},
                      "primeira": "2026-08-09", "ultima": "2026-11-03",
                      "marcos": ["estagnou em 14/09", "repassado via Busca em 20/10"]},
  "atividades_recentes": ["8 itens na íntegra: 4 WhatsApp no ciclo atual (21/10 a 03/11), 1 estagnação, 3 WhatsApp enviados em set."],
  "anotacoes": [{"data": "2026-10-20", "texto": "Lead repassado via Busca", "fixada": false}],
  "lia": {"status": "qualificado", "nivel": "morno", "repassado_em": "2026-09-06", "ciclo": "anterior",
          "resumo": "Interesse nas casas de 3 dorm., dúvidas sobre condomínio e mobília, mora em apartamento.",
          "mensagens": 17},
  "disparos": [], "oferta_ativa": [],
  "pendencias": {"tarefas_pendentes": 0, "proxima_visita": null}, "negocio": null, "parceria": null,
  "memoria": [],
  "lacunas": ["orçamento", "forma de pagamento", "prazo", "sem tarefa futura", "WhatsApps do ciclo atual sem resultado registrado"]
}
```
Observação: das 249 conversas da Lia, só 152 têm lead ligado e só 22 estão em leads ativos — por isso a ligação por telefone é necessária.

## Detalhes técnicos
- 1 migration (DDL): função `homi_normaliza_tel(text)` imutável; índice de expressão em `pipeline_leads`, `lia_conversas`, `whatsapp_respostas`, `oferta_ativa_leads` pela chave; função `homi_dossie_lead(uuid)` SECURITY INVOKER, `STABLE`, retorna jsonb; troca da chave única e das políticas de `homi_memoria_lead`. Horário 08–19h BRT.
- `homi-tools.ts`: `readLeadHistory` chama a RPC com o JWT do corretor; registra uso em `homi_ia_uso`.
- Testes: vitest para a normalização do telefone (casos 10–13 dígitos, com 55, sem 9º dígito, lixo) e script SQL da bateria com resultado salvo.
- Desfazer: migration guarda a definição antiga da chave/políticas; função nova pode ser removida sem afetar telas.

## Pendência registrada
Passo 1c (fechar de vez a `homi_consulta`) para planejar a partir de 12/11/2026, se ninguém aparecer no log.
