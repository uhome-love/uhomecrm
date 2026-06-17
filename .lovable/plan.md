# Liberar visão dupla (Gerente + Corretor) para Junior Padilha

## Contexto
Junior já tem os papéis `gestor` + `corretor` no banco e o auth ID dele (`7a270cc1-…`) já está no allowlist `CORRETOR_MODE_GESTORES` em `Sidebar.tsx`. O grupo "Modo Corretor" já existe, mas:
- Está com **Minha rotina** e **Oferta ativa (corretor)** — falta **Central de tarefas**.
- A alteração precisa estar efetivamente aplicada/publicada para aparecer no menu dele (na tela atual ainda só aparece a visão de gerente).

Bruno e Gabriel **não** entram nesse allowlist, então só o Junior vê esses itens.

## Mudança

### `src/components/layout/Sidebar.tsx`
Atualizar o `MODO_CORRETOR_GROUP` para incluir os 3 acessos pedidos:

```text
Modo Corretor
├── Minha rotina         → /corretor
├── Central de tarefas   → /minhas-tarefas   (NOVO)
├── Aceite de leads      → /aceite           (manter)
└── Oferta ativa         → /corretor/call
```

Adiciona o item "Central de tarefas" apontando para `/minhas-tarefas` (mesma rota usada no menu do corretor) com o ícone `ListTodo`.

## Resultado
- Junior continua com todo o menu de Gerente (Dashboard, Meu time, Pipeline, etc.) e ganha o bloco "Modo Corretor" no fim da sidebar com: Minha rotina, Central de tarefas, Aceite de leads e Oferta ativa.
- Nenhuma mudança de banco é necessária (papéis e team_members já configurados).
- Apenas frontend; gating restrito ao Junior via allowlist existente.

## Observação técnica
A condição que renderiza o grupo (`role === "gestor" && userId ∈ CORRETOR_MODE_GESTORES`) já está correta e validada no banco. Após aplicar, basta recarregar/publicar para o grupo aparecer.