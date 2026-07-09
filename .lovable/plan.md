## Objetivo

Confirmar, com gravação real no banco, que os fluxos de escrita do PDN funcionam ponta a ponta e **não tocam no pipeline do corretor**. Nenhuma mudança de código — é um teste controlado com reversão ao final.

## O que será testado (via app, logado como CEO)

1. **Mudar etapa (overlay)**
   - Escolher um negócio de teste do pipeline e mudar a etapa no PDN (ex.: Visita Realizada → Em Negociação).
   - Verificar no banco que gravou `grupo_override` em `pdn_entries` e que `pipeline_leads`/`negocios` do corretor **permaneceram inalterados**.
   - Conferir o selo "ajustada pelo gestor" e o botão "Voltar à etapa do pipeline".

2. **Voltar à etapa do pipeline**
   - Reverter o override e confirmar que `grupo_override` volta a `null` e a linha exibe a etapa natural.

3. **Avisar corretor (notificação no app)**
   - Disparar "Avisar corretor" e confirmar:
     - registro em `notifications` para o `auth id` do corretor (tipo `pdn`);
     - `corretor_avisado_em` / `corretor_avisado_etapa` gravados;
     - selo "Avisado dd/MM" na UI.

4. **Congelamento de meses**
   - Conferir que negócio em aberto não aparece em mês passado sem override, e aparece no mês corrente.

## Reversão

Ao final, limpar todos os artefatos do teste (override, flags de aviso e a notificação criada) para deixar os dados exatamente como estavam. Relato o resultado de cada passo com evidência (screenshot + consulta ao banco).

## Técnico

- Interação via Playwright na app em localhost com a sessão do usuário; leituras de verificação via consultas SQL.
- Limpeza final via remoção/atualização das linhas de teste em `pdn_entries` e da notificação de teste.
- Zero alteração em código-fonte.