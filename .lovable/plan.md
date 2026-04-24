
## Bug: tarefas sumindo na Central de Tarefas

### Causa raiz (confirmada no banco)

O `useQuery` em `src/pages/MinhasTarefas.tsx` (linhas 121-164) monta a URL assim:

```ts
query.or(`pipeline_lead_id.in.(${myLeadIds.join(",")}),responsavel_id.eq.${user.id},created_by.eq.${user.id}`)
```

Para corretores com muitos leads, a URL fica gigantesca:

| Corretor | Nº leads | Tamanho aprox. da URL `IN (...)` |
|---|---:|---:|
| **Jessica** | 342 | **~12.6 KB** |
| **Ebert** | 314 | ~11.6 KB |
| Thalia | 240 | ~8.9 KB |
| Adri | 148 | ~5.5 KB |

Acima de ~8 KB o gateway corta o request (HTTP 414 / "URI Too Long"). O `catch` na linha 146 retorna `[]` silenciosamente — daí o **"0 pendentes"** no print, mesmo a Jessica tendo **210 tarefas pendentes** no banco e o Ebert **144**.

A linha 235 (`activeTab === "concluidas" ? concluidas`) mostra ainda 20 itens porque `concluidas.slice(0, 20)` opera em cima do mesmo array vazio (no print devem ser tarefas de outro contexto antes do erro, ou cache). O importante é que **as pendentes não aparecem para corretores com volume real**.

### Verificação adicional

- 209 de 210 tarefas pendentes da Jessica têm `responsavel_id = jessica.user_id`. Ou seja, **o filtro por `responsavel_id` sozinho já cobre 99,5% dos casos** sem precisar montar a lista de lead-ids.
- A coluna `responsavel_id` já existe e é populada por todos os fluxos modernos de criação (Pipeline, HOMI, Roleta, scripts de IA).
- 307 tarefas históricas têm `responsavel_id NULL` — mas são minoria absoluta e nenhuma é da Jessica/Ebert.

### Plano de correção

#### 1. Reescrever a query de "Tarefas de Leads" (`src/pages/MinhasTarefas.tsx` linhas 121-164)

Trocar a estratégia de "buscar todas as IDs de leads e mandar via `IN`" por **uma query simples filtrando por `responsavel_id` ou `created_by`** — que é o que cobre 99% dos casos e nunca explode o tamanho da URL:

```ts
const { data, error } = await supabase
  .from("pipeline_tarefas")
  .select("*")
  .or(`responsavel_id.eq.${user.id},created_by.eq.${user.id}`)
  .order("vence_em", { ascending: true })
  .order("hora_vencimento", { ascending: true })
  .limit(2000);
```

Isso elimina:
- A primeira query "buscar todos os meus lead-ids".
- A montagem da URL gigante.
- O modo de falha silenciosa (a query passa a sempre funcionar).

Para os ~71 leads históricos com `responsavel_id NULL`, criar um **fallback opcional**: uma segunda query buscando tarefas pendentes de leads onde `corretor_id = user.id AND responsavel_id IS NULL`, limitada a 200 — essa pode usar IN com segurança porque são poucas. Mesclar os dois resultados via `Map` por id (deduplicação).

#### 2. Tornar o erro visível (não engolir mais)

Trocar `if (error) return [];` por:

```ts
if (error) {
  console.error("[MinhasTarefas] erro:", error);
  toast.error("Erro ao carregar tarefas");
  throw error; // deixa react-query mostrar o estado de erro
}
```

Assim, se algo falhar no futuro, o problema fica óbvio em vez de mostrar lista vazia.

#### 3. Migrar o widget da Home para a mesma estratégia (já está OK)

`src/components/corretor/MinhaAgendaWidget.tsx` (linhas 62-93) **já usa apenas `responsavel_id/created_by`** — sem o problema. Apenas adicionar o mesmo `console.error` para consistência de diagnóstico.

#### 4. Validação após o fix

- Logar como Jessica (342 leads, 210 pendentes) e Ebert (314 leads, 144 pendentes): badge "Pendentes" deve refletir os números reais.
- Conferir que as abas Hoje/Amanhã/Semana/Atrasadas filtram corretamente.
- Garantir que tarefas atribuídas pelo admin (com `created_by = admin` mas `responsavel_id = corretor`) continuam aparecendo na visão do corretor.

### O que NÃO muda
- Aba "Tarefas de Negócios" (já usa `responsavel_id` puro, sem o problema).
- Lógica de criar/editar/adiar/concluir tarefa.
- RLS — continua valendo as policies atuais.

### Risco residual
Tarefas legadas com `responsavel_id NULL` (~71 no banco todo, principalmente leads inativos antigos) só apareceriam via fallback opcional. Como o usuário não relatou esse caso e o volume é desprezível, podemos validar se é necessário implementar o fallback ou se basta garantir que toda criação nova preencha `responsavel_id` (o que já acontece).
