

# Plano: Dialog "Iniciar conversa" com busca e filtro por etapa

## Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `src/components/whatsapp/ConversationList.tsx` | Substituir Popover por Dialog com busca, chips de etapa e lista enriquecida |

Nenhum outro arquivo será alterado.

## Implementação

### 1. Substituir Popover por Dialog

Remover `Popover/PopoverContent/PopoverTrigger`. Importar `Dialog, DialogContent, DialogHeader, DialogTitle` de `@/components/ui/dialog`. O botão "Nova conversa" abre o Dialog via `newConvOpen`.

### 2. Estado adicional

```typescript
const [stages, setStages] = useState<{ id: string; nome: string }[]>([]);
const [selectedStageId, setSelectedStageId] = useState<string | null>(null); // null = "Todas"
const [dialogLeads, setDialogLeads] = useState<any[]>([]);
const [dialogLoading, setDialogLoading] = useState(false);
```

### 3. Carregar etapas ao abrir Dialog

`useEffect` quando `newConvOpen === true`: buscar `pipeline_stages` ORDER BY `ordem ASC`. Guardar em `stages`. Executado uma vez (ou sempre que abre, sem cache complexo).

### 4. Carregar leads ao abrir / mudar filtros

`useEffect` com debounce (300ms) quando `newConvOpen`, `newConvSearch` ou `selectedStageId` mudam:

```sql
pipeline_leads
  WHERE corretor_id = userId
  AND (nome ILIKE '%busca%' se busca)
  AND (stage_id = selectedStageId se filtro)
  ORDER BY updated_at DESC
  LIMIT 20
```

Ao abrir sem busca e sem filtro: retorna os 20 leads mais recentes.

### 5. Layout do Dialog

```
DialogContent max-w-md
├── DialogHeader: "Iniciar conversa"
├── Input de busca (com ícone Search)
├── Chips de etapa (flex wrap, gap-1.5)
│   ├── [Todas] — ativo se selectedStageId === null
│   └── [Stage.nome] × N — ativo se selectedStageId === stage.id
│   Ativo: bg-[#4F46E5] text-white
│   Inativo: bg-muted text-muted-foreground
├── Lista (max-h-[50vh] overflow-y-auto)
│   └── Cada item:
│       ├── Avatar (iniciais + cor)
│       ├── Nome + Empreendimento (muted)
│       ├── Chip da etapa (pequeno, colorido)
│       └── "há X tempo" (updated_at)
│       onClick → onSelect(lead.id) + fecha dialog
└── Empty/Loading states
```

### 6. Query inclui stage_id e stage nome

```typescript
.select("id, nome, empreendimento, updated_at, stage_id, pipeline_stages(nome)")
```

Isso permite exibir o chip da etapa em cada item sem query extra.

### 7. Limpeza ao fechar

Ao fechar dialog: resetar `newConvSearch`, `selectedStageId`, `dialogLeads`.

