import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DOCUMENTOS_NEGOCIO, type DocumentosNegocio } from "@/lib/jornadaNegocio";

export function DocumentosChecklist({ value, onChange, disabled = false }: { value: DocumentosNegocio; onChange: (value: DocumentosNegocio) => void; disabled?: boolean }) {
  return <section className="space-y-3">
    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Documentos do cliente</h3><span className="text-xs text-muted-foreground">{Object.values(value).filter(Boolean).length} / 3</span></div>
    {DOCUMENTOS_NEGOCIO.map(item => <div key={item.key} className="flex items-center gap-3 border-b border-border py-3">
      <Checkbox id={`documento-${item.key}`} checked={value[item.key]} disabled={disabled} onCheckedChange={checked => onChange({ ...value, [item.key]: checked === true })} />
      <Label htmlFor={`documento-${item.key}`} className="cursor-pointer text-sm">{item.label}</Label>
    </div>)}
    <p className="text-xs text-muted-foreground">Conferência informativa</p>
  </section>;
}