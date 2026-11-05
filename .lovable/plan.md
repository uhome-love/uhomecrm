# HOMI — Passo 1b: segurança das listas e da consulta externa

Este passo não muda nenhuma tela do CRM nem o HOMI dentro do CRM.

## a) As outras 6 listas `homi_*`

**Situação conferida hoje:**
- `homi_corretores`, `homi_equipe`, `homi_leads_etapa`, `homi_negocios`, `homi_vendas` e `homi_visitas` estão todas liberadas para leitura (e até escrita tentada) por visitante sem login (anon) e por qualquer usuário logado.
- Elas não respeitam a proteção do banco (sem `security_invoker`).

**Quem usa:**
- Código das telas e funções do servidor: **ninguém**. A busca no projeto não encontrou nenhum uso.
- Banco: só `homi_consulta`. Ela roda com permissão do dono, então continua funcionando depois do corte.
- Acesso de leitura: `homi_ro`.

**Mudança (1 migration):**
```sql
REVOKE ALL ON public.homi_corretores, public.homi_equipe, public.homi_leads_etapa,
  public.homi_negocios, public.homi_vendas, public.homi_visitas FROM anon, authenticated;
```
`homi_ro` e `service_role` continuam com acesso.

## b) Chave fixa da `homi_consulta`

**Situação conferida hoje:**
- A chave está escrita dentro da própria função.
- A função pode ser chamada por qualquer pessoa com a chave pública do app (anon tem permissão de execução).
- Testei hoje: com a chave fixa, um visitante sem login lê os dados.

**Mudança (mesma migration ou a seguinte, máx. 2/dia):**
1. Gerar uma chave nova e guardar no Vault (`homi_consulta_chave`). Ninguém vê o valor no código.
2. A função passa a comparar com o valor do Vault. A chave antiga para de funcionar.
3. Nova tabela `homi_consulta_log`, que guarda só acréscimos:
   - quando foi o uso;
   - quem chamou (papel);
   - quais listas foram lidas;
   - quantas linhas voltaram;
   - se deu certo ou erro.
   - O texto da consulta é guardado no máximo com 500 caracteres. Não guarda nomes de clientes.
   - Leitura só para admin e diretor.
4. `REVOKE EXECUTE` de anon e authenticated. Só `service_role` e `homi_ro` (ou o usuário externo combinado) chamam a função.
5. **Atenção:** quem usa a consulta externa (ex.: o HOMI fora do CRM) para de funcionar até receber a chave nova. Preciso que você me diga quem é esse consumidor antes de trocar.

## c) Como desfazer
- **Listas:** `GRANT SELECT ON <lista> TO authenticated;` só para a lista que quebrar.
- **Chave:** recolocar a comparação antiga na função (definição atual guardada) e devolver `GRANT EXECUTE` a anon.
- **Log:** `DROP TABLE public.homi_consulta_log;`, porque é uma tabela nova.

## Como testar
1. Visitante sem login e corretor logado recebem "sem permissão" nas 6 listas.
2. `homi_ro` continua lendo as 6 listas.
3. A chave antiga é recusada, a chave nova funciona, e cada chamada gera 1 linha no log.
4. Abrir o `/homi`, o Painel CEO e o Pipeline e confirmar que não aparece nenhum erro.
