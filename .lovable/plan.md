# Auditoria da aba Pós-Visita (visão Negócios)

## O que eu conferi (dados reais, só leitura)

A coluna **Pós-Visita** tem hoje **81 leads ativos** (não arquivados). Cruzei cada um com: visita realizada registrada, último toque, atividades, negócio vinculado e dono.

Resultado:

| Grupo | Qtd | Situação |
|---|---|---|
| Com visita realizada e toque recente (≤14 dias) | 60 | Saudável — não mexer |
| Com visita realizada, mas parados 14–30 dias | 5 | Real, só precisa de cobrança |
| **Bruno Schuler (gerente) — leads herdados de 2025** | **14** | Suspeitos de resíduo (detalhe abaixo) |
| Bruno Schuler — com visita real | 2 | Reais (Nathalia Paz, Cristina Biehl) |

Sobre "negócios com o Bruno": na tabela de **negócios ativos** o Bruno **não tem nenhum**. O que aparece com o nome dele são **leads na coluna Pós-Visita** — 16 no total.

### Os 14 do Bruno em detalhe

Todos entraram na etapa no **mesmo dia (27/07/2026)**, o que indica migração em lote, e todos têm:
- criação entre **mar/2025 e dez/2025**;
- **nenhuma visita registrada** na agenda;
- **último toque igual à data de criação** (nunca tocados desde 2025);
- **nenhum negócio** vinculado;
- `flag_status = {"status_visita":"realizada"}` sem `visita_id` — ou seja, a etapa veio de um flag legado, não de uma visita de verdade.

Nomes: William Lyra, Susi, Vanessa Martins Marques (v. futura), Sérgio Endler, Diego Peng Goulart, Vinícius (v. futura), Daiane Kaczanoski, Alex Prado Ilha, Jorge Cunha, Marcelo da Roleta, MANOELA BARBOSA, Pedro Donato, Ronaldo Fernando, Ana Mariza Pozzobon.

Exceção dentro do grupo: **Vinícius (v. futura)** tem 12 atividades (última em mai/2026) — não entra em nenhuma limpeza automática.

Também há 2 leads **sem visita registrada mas ativos** (Thiago Lorenzzoni e Lucas Drago, da Luiza Clós — tocados em 10–11/08). **Ficam onde estão.**

## Proposta (conservadora, nada some de verdade)

Regra de corte, exigindo **todas** as condições ao mesmo tempo:
entrou na etapa no lote de 27/07 **E** sem visita realizada **E** sem negócio **E** sem atividade nenhuma **E** sem toque há mais de 180 dias.

Isso captura **13 leads** (os 14 do Bruno menos o Vinícius). Nenhum lead com visita, atividade, negócio ou toque recente é tocado.

Passos:

1. **Tela de conferência antes de qualquer mudança.** Uma lista dentro da própria aba Pós-Visita ("Resíduo legado — 13") mostrando nome, dono, data de criação, último toque e o motivo do enquadramento, com checkbox por lead. Nada acontece sem você marcar e confirmar.
2. **Ação escolhida por você, por lead:** mover para **Descarte** (reengajável, volta pelo fluxo de nutrição) ou **manter na Pós-Visita**. Sem exclusão, sem arquivamento permanente — o lead continua existindo e reversível.
3. **Backup antes de executar:** snapshot dos ids/etapa/dono numa tabela de rollback, para desfazer em um comando se algo estiver errado.
4. **Vinícius (v. futura)** entra numa lista separada "revisar manualmente" (tem histórico), sem ação automática.
5. **Os 5 parados 14–30 dias** viram apenas um aviso de cobrança na coluna (chip "parado há X dias"), sem mover nada.
6. **Causa raiz:** a etapa Pós-Visita aceitou leads apenas pelo `flag_status.status_visita = "realizada"` sem visita na agenda. Proposta: passar a exigir visita registrada (ou `visita_id` no flag) para entrar na coluna daqui pra frente, e mostrar um selo "sem visita registrada" nos casos legados que restarem.

## Detalhes técnicos

- Consulta de enquadramento roda sobre `pipeline_leads` (stage `pos_visita`, `arquivado = false`) com anti-joins em `visitas` (status `realizada`) e `pipeline_atividades`, mais `negocio_id is null`.
- Nenhuma migration destrutiva: a ação de descarte usa o fluxo já existente de descarte reengajável; a tabela de rollback é aditiva.
- Frontend: painel novo dentro de `NegociosWorkspace.tsx` / hook `useNegociosBoard.ts` (leitura), mais um hook de ação em lote com confirmação.

## Confirmação necessária antes de construir

- A ação para o resíduo legado deve ser **Descarte reengájavel** (volta pela nutrição) ou **Sem Contato / roleta como lead novo**?
- Os 13 devem sair do nome do Bruno ou permanecer com ele mesmo após a mudança de etapa?
