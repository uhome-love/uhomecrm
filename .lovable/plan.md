## Objetivo
Fazer a página **Intermediação** (`/intermediacao`) puxar corretamente a lista de corretores para gestores (hoje só funciona para admin) e endurecer o carregamento.

## Causa raiz
A página lê `user_roles` direto:
```ts
supabase.from("user_roles").select("user_id").eq("role","corretor")
```
O RLS de `user_roles` só permite `admin` (todas) ou o próprio usuário (a sua). Um **gestor não consegue ler as roles dos outros**, então a lista vem vazia e o `<Select>` de corretores fica sem opções.

## Mudanças propostas

### 1. Nova RPC `SECURITY DEFINER` (migration)
`public.get_corretores_intermediacao()` retorna `user_id, nome, cpf, email, creci` de todos os usuários com role `corretor`, ordenado por nome. `SECURITY DEFINER` + `set search_path = public`, `GRANT EXECUTE` para `authenticated`. Internamente valida que o chamador é `admin` ou `gestor` via `has_role(auth.uid(), ...)` (mesma regra da edge function), retornando vazio caso contrário.

### 2. `src/pages/IntermediacaoPage.tsx`
- Trocar o `useEffect` de carregamento por `supabase.rpc("get_corretores_intermediacao")`.
- Adicionar estado `carregandoCorretores` + tratamento de erro com `toast.error`.
- Mostrar "Nenhum corretor encontrado" / spinner no `<Select>` quando vazio ou carregando.
- Regenerar tipos do Supabase para a nova RPC.

## Fora de escopo (anotado, não implementar agora sem confirmação)
- Persistir o contrato gerado em tabela/storage.
- Trazer RG e % de comissão do cadastro (campos não existem em `profiles`).
- Usar CRECI no documento.
- Revisar o credor fixo "Gabrielle Rodrigues" à luz da reorganização de equipes.

## Validação
- Logar/testar como gestor: confirmar que os 33 corretores aparecem no Select.
- Gerar um `.docx` de teste e confirmar download.

## Detalhes técnicos
- 1 migration (RPC + grant). Respeitar janela de migrations (máx 2/dia, 08–19h BRT).
- Edge function `gerar-intermediacao` permanece inalterada (já valida admin/gestor).