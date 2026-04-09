

# Plano Atualizado: Refatorar /imoveis para tabela `imoveis` do site

## Ponto 1 do usuario: Schema discovery obrigatorio

Concordo. O primeiro passo da implementacao sera executar no console:

```typescript
const { data, error } = await supabaseSite.from('imoveis').select('*').limit(3);
console.log({ data, error });
```

O mapeamento `mapDocSite()` so sera escrito APOS inspecionar o resultado real. Se `data` vier `null`/vazio e `error` indicar RLS, paramos e orientamos a adicionar a policy no projeto do site.

## Ponto 2 do usuario: RLS no projeto do site

Se a query retornar vazio (provavelmente por falta de policy de SELECT para `anon`), a solucao e adicionar no Supabase do site (huigglwvvzuwwyqvpmec):

```sql
CREATE POLICY "Allow anon read on imoveis"
ON public.imoveis
FOR SELECT
TO anon
USING (true);
```

Isso precisa ser feito no painel do projeto do **site**, nao do CRM. O Lovable nao tem acesso para criar migrations nesse projeto externo. Se necessario, informaremos o usuario para aplicar manualmente.

## Sequencia de execucao

### Passo 1 — Schema discovery (obrigatorio antes de tudo)
- Executar `supabaseSite.from('imoveis').select('*').limit(3)` via script
- Mostrar o resultado ao usuario
- Se vazio com erro de RLS → instruir a adicionar policy acima
- Se OK → mapear os nomes reais das colunas

### Passo 2 — Criar servico + atualizar pagina
- Criar `src/services/siteImoveisRemote.ts` usando `supabaseSite` com os nomes de colunas reais descobertos no passo 1
- Atualizar `ImoveisPageNew.tsx` para importar e usar o novo servico
- Filtros, paginacao, ordenacao, cards, links "Ver no site" com `https://uhome.com.br/imovel/{slug}`

### Passo 3 — Polish
- Autocomplete de bairros via distinct no `supabaseSite`
- Botoes "Copiar link" com toast
- Responsividade do grid (3/2/1 colunas)

## Arquivos modificados
| Arquivo | Acao |
|---------|------|
| `src/services/siteImoveisRemote.ts` | **Novo** — queries via `supabaseSite` |
| `src/pages/ImoveisPageNew.tsx` | Trocar fonte de dados |

## Arquivos NAO modificados
- `src/services/siteImoveis.ts` — mantido intacto
- `src/lib/supabaseSite.ts` — mantido intacto
- Nenhum componente fora de `/imoveis`

