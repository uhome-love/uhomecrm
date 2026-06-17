## Objetivo
No menu lateral do Junior Padilha (gestor com Modo Corretor), exibir o grupo **Modo Corretor** logo acima de **Gestão de Leads**, em vez de no final da lista.

## Mudança
Arquivo: `src/components/layout/Sidebar.tsx` (linha ~329)

Hoje o grupo é anexado ao fim:
```ts
const rawGroups = showCorretorMode ? [...baseGroups, MODO_CORRETOR_GROUP] : baseGroups;
```

Passa a ser inserido logo após o grupo "Principal" (posição 1), ficando acima de "Gestão de Leads":
```ts
const rawGroups = showCorretorMode
  ? [baseGroups[0], MODO_CORRETOR_GROUP, ...baseGroups.slice(1)]
  : baseGroups;
```

## Escopo
- Apenas frontend/apresentação; nenhuma mudança de banco ou lógica.
- Afeta somente o Junior (único no allowlist `CORRETOR_MODE_GESTORES`); Bruno e Gabriel não são impactados.
