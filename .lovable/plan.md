

# Plano: Barra de ações rápidas + Templates no ConversationThread

## Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `src/components/whatsapp/ConversationThread.tsx` | Adicionar barra de 5 ações, templates, dialogs, notas internas, renderização de notes na thread |

Nenhum outro arquivo será alterado.

## Implementação

### 1. Barra de ações (entre Copilot e Input)

5 botões compactos com tooltip usando Lucide icons:
- **FileText** Templates — Popover
- **Calendar** Visita — Dialog
- **CheckSquare** Tarefa — Popover
- **ArrowRight** Etapa — Popover
- **StickyNote** Nota — Toggle (altera modo do textarea)

### 2. Templates (Popover)

Templates hardcoded agrupados por etapa, filtrados por `leadInfo.stage_id`. Variáveis `{nome}`, `{empreendimento}`, `{data}` substituídas ao clicar. Preenche textarea e fecha popover.

Mapeamento de stage_ids para grupos de templates será feito comparando `stage_id` com os estágios conhecidos (busca `pipeline_stages` no mount para montar mapa nome→id).

### 3. Agendar Visita (Dialog)

Campos: data (min=hoje), hora (select 08:00-18:00 / 30min), local (pré-preenchido com empreendimento).

Ao confirmar:
- Insert em `visitas` (lead_id, corretor_id=profileId, data_visita, empreendimento, status='agendada')
- Update `pipeline_leads.stage_id` para stage de Visita (busca `pipeline_stages WHERE nome ILIKE '%visita%'`)
- Preenche textarea com template de confirmação
- Toast de sucesso

### 4. Criar Tarefa (Popover)

Input título + select prazo (Hoje 18h / Amanhã 10h / 3 dias / 1 semana). Insert em `pipeline_tarefas` com tipo 'follow_up', status 'pendente'. Toast de sucesso.

### 5. Mover Etapa (Popover)

Busca `pipeline_stages` (pipeline_tipo='leads', ativo=true) ORDER BY ordem. Lista como botões, etapa atual destacada. Ao clicar: update `pipeline_leads.stage_id`. Toast com nome da etapa.

### 6. Nota Interna (Toggle)

Estado `isNoteMode`. Quando ativo:
- Textarea com fundo amarelo (`bg-amber-50 border-amber-300`)
- Placeholder "Nota interna (não enviada ao lead)..."
- Botão enviar com ícone Lock
- Insert em `whatsapp_mensagens` com `direction: 'note'`
- NÃO chama edge function `whatsapp-send`

### 7. Renderização de notes na thread

Mensagens com `direction === 'note'`:
- Alinhadas à direita
- Fundo `bg-amber-100 border-amber-300`
- Label "Nota interna 🔒" acima do body
- Mesmo formato de hora

### Estado adicional necessário

```typescript
const [isNoteMode, setIsNoteMode] = useState(false);
const [stages, setStages] = useState<{id:string, nome:string}[]>([]);
const textareaRef = useRef<HTMLTextAreaElement>(null);
```

useEffect no mount para buscar `pipeline_stages` (necessário para Templates, Etapa e Visita).

### Imports adicionais

```typescript
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { FileText, Calendar, CheckSquare, ArrowRight, StickyNote, Lock } from "lucide-react";
```

