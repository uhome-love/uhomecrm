
# Fix: botão "Parceria" no pipeline de Negócios

## Causa raiz

No card de negócio, o item de menu "Parceria" (e também "Repassar negócio") **é renderizado sem `onClick`** — só mostra o ícone, nada acontece ao clicar. O mesmo bug existe em **dois lugares**, porque o card foi duplicado:

- `src/components/negocios/NegocioCard.tsx:286`
- `src/pages/MeusNegocios.tsx:403` (cópia inline do mesmo card)

No pipeline de Leads o botão funciona porque `PipelineCard.tsx` instancia o `PartnershipDialog` corretamente — basta replicar esse padrão nos dois cards de Negócios.

## Mudança (apenas Parceria — escopo do pedido)

Em cada um dos dois arquivos:

1. Importar `PartnershipDialog` de `@/components/pipeline/PartnershipDialog`.
2. Adicionar estado local `const [partnerOpen, setPartnerOpen] = useState(false);`.
3. Trocar o `<DropdownMenuItem>` de Parceria por uma versão com handler:
   ```tsx
   <DropdownMenuItem
     className="gap-2 cursor-pointer text-xs"
     onClick={(e) => {
       e.stopPropagation();
       if (!negocio.pipeline_lead_id) {
         toast.error("Negócio sem lead vinculado — não é possível registrar parceria");
         return;
       }
       setPartnerOpen(true);
     }}
   >
     <Handshake className="h-3.5 w-3.5" /> Parceria
   </DropdownMenuItem>
   ```
4. Renderizar o dialog dentro do card (próximo aos outros popups já existentes):
   ```tsx
   {partnerOpen && negocio.pipeline_lead_id && (
     <PartnershipDialog
       open={partnerOpen}
       onOpenChange={setPartnerOpen}
       leadId={negocio.pipeline_lead_id}
       leadNome={negocio.nome_cliente}
       corretorPrincipalId={null}
     />
   )}
   ```

`corretorPrincipalId={null}` faz o dialog usar `user.id` (auth) do usuário logado como principal — mesmo contrato já validado no fluxo da Roleta/Leads. `pipeline_parcerias` é insertado com divisão fixa 50/50 e dispara o `useCreateParceria`, que invalida `parceriaKeys.map()` — o badge "Parceria 50%" aparece automaticamente no card.

## Não está no escopo

- **"Repassar negócio"** (mesmo bug, sem handler) — só corrigir se o usuário pedir.
- Refator para deduplicar `NegocioCard.tsx` ↔ card inline em `MeusNegocios.tsx` — fica como dívida; agora é só destravar o clique.
- Mexer no `PartnershipDialog`, em `useParcerias` ou na RLS de `pipeline_parcerias`.

## Validação após build

1. Abrir `/pipeline-negocios`, clicar `⋮` em um negócio com `pipeline_lead_id` → "Parceria" abre o dialog.
2. Selecionar parceiro → toast "Parceria registrada com sucesso!".
3. Badge de parceria aparece no card sem refresh manual.
4. Em um negócio sem `pipeline_lead_id` (caso raro) → toast de erro, sem crash.
