# Intermediação da Cristina Wiegand Zanetti (Junior) — erro ao gerar

## O que foi verificado
- A cliente existe no Pipeline: corretor Pedro Jorge, equipe do Junior, Casa Tua Canoas, negócio ativo em "Em Negociação". O Junior tem acesso a ela. Permissão não é o problema.
- Nenhuma intermediação dela foi gravada, e nenhum documento ficou salvo. A tentativa foi recusada antes de terminar.
- O sistema tem várias conferências antes de gravar, por exemplo: percentuais somando 100%, soma das parcelas igual à comissão, vencimento preenchido em todas as parcelas, corretor/gerente escolhidos da lista oficial e a mesma pessoa não repetida.
- **Problema principal:** quando uma dessas conferências falha, a tela mostra só um erro genérico e esconde o motivo real. O motivo também não fica registrado. Por isso ainda não dá para dizer qual campo travou.

## O que será feito
1. A tela de intermediação passa a mostrar o **motivo real** em português (ex.: "A soma das parcelas deve ser igual à comissão bruta").
2. A função passa a **registrar o motivo** de toda recusa, para conferirmos sem depender de print.
3. Teste com cliente de teste: forçar 2 erros (parcelas que não fecham, beneficiário repetido) e ver a mensagem clara; depois gerar uma intermediação válida e apagar tudo.
4. Pedir ao Junior para tentar de novo. A mensagem vai mostrar o que corrigir. Se for falha do sistema e não de preenchimento, corrijo na hora.

## O que NÃO muda
Regras de cálculo, NF −10%, forma de pagamento, permissões e documento gerado.

## Detalhes técnicos
- `src/pages/IntermediacaoPage.tsx` (invoke ~linha 351): em caso de erro, ler `error.context.json()` para pegar `{error}` do servidor (string ou `flatten()` do zod) e mostrar no toast.
- `supabase/functions/gerar-intermediacao/index.ts`: no `catch`, usar `console.error` com a mensagem e gravar em `ops_events` (best-effort); passar a devolver 400 para erros de validação (zod, `intermediacao_salvar`, `intermediacao_validar_alocacoes`) e 500 só para falha inesperada. Fazer deploy.
- Sem migration.
