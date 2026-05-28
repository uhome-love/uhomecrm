## Diagnóstico — Modal Nova Visita (`src/components/visitas/VisitaForm.tsx`)

Auditei o componente, o hook `useVisitas.createVisita`, o schema da tabela `visitas`, RLS e triggers. **Schema, constraints, triggers e RLS estão OK** — `local_visita` é `text` nullable, sem CHECK constraint. Não há nada no backend que rejeite o valor. O erro percebido pelo usuário vem do **frontend**.

Encontrei **4 bugs reais** no modal que explicam o corretor não conseguir finalizar:

### Bug #1 — Validação silenciosa de `responsavel_visita` quebra o submit
`useVisitas.createVisita` (linha ~324) força `responsavel_visita` quando `tipo === "lead"`. O default no form é `"proprio_corretor"`, **mas** `RESPONSAVEL_OPTIONS` em `ReuniaoNegocioForm.tsx` usa `"corretor"` — e em outros lugares o valor enviado pode ser sanitizado a null. No `VisitaForm.tsx` o default está correto, **mas** se o usuário abre o dropdown e fecha sem escolher (Radix Select em mobile), o valor não muda. O problema real: o validador exige `responsavel_visita` mas o botão de submit **não** está desabilitado por isso — então o usuário clica, recebe toast genérico e não entende.

### Bug #2 — Dois campos de "Imóvel" duplicados visíveis simultaneamente
Na screenshot aparece "Casa Tua" no input Jetimob **e** no combobox "Ou selecione um empreendimento da carteira". A lógica `{!imovelSearch && !selectedImovel}` deveria esconder o segundo, mas como ambos chamam `set("empreendimento", value)`, há race condition: digitando no Jetimob seta `empreendimento`, então `imovelSearch` fica preenchido mas o combobox renderiza o valor mesmo assim em re-render. Confunde o usuário (parece que precisa preencher os dois).

### Bug #3 — Botão "Trocar" do Cliente não limpa `nome_cliente`
Linha 427: `onClick={() => set("pipeline_lead_id", "")}` zera apenas o id. O `nome_cliente` continua "Amadeu" no estado. Se o corretor trocar de cliente e tentar submeter sem re-selecionar da lista, o validador passa (nome ok), o `pipeline_lead_id` falha com "Selecione um lead válido da lista" — mas o input mostra "Amadeu" preenchido, ficando confuso.

### Bug #4 — Select "Local da Visita" sem feedback de erro visível em mobile
O Radix `Select` com `SelectContent` default não usa `position="popper"` explicitamente em alguns casos. Em viewport 440px o dropdown pode abrir fora da tela. Provável causa do "está dando erro" relatado: o dropdown não abre/abre cortado e o corretor não consegue escolher → como `local_visita` é opcional o submit funcionaria mesmo vazio, **mas** combinado com Bug #1 (responsavel não setado em algum fluxo) o submit falha em seguida.

---

## Plano de correção (escopo cirúrgico, só frontend)

### Arquivos a alterar
1. **`src/components/visitas/VisitaForm.tsx`**

### Mudanças

**1. Botão "Trocar" do Cliente — limpar nome também**
```diff
- onClick={() => set("pipeline_lead_id", "")}
+ onClick={() => {
+   setForm(f => ({ ...f, pipeline_lead_id: "", nome_cliente: "", telefone: "", empreendimento: "" }));
+   setFormErrors({});
+ }}
```

**2. Imóvel — esconder combobox da carteira quando QUALQUER campo de empreendimento estiver preenchido**
```diff
- {!imovelSearch && !selectedImovel && (
+ {!imovelSearch && !selectedImovel && !form.empreendimento && (
```
E adicionar um botão "limpar" no input Jetimob quando preenchido (para reabrir o combobox da carteira).

**3. Local da Visita — forçar `position="popper"` no SelectContent + sideOffset**
```diff
- <SelectContent>
+ <SelectContent position="popper" className="z-[60] max-h-[40vh]">
```
Aplicar o mesmo em Responsável e Corretor para garantir consistência mobile.

**4. Botão Submit — desabilitar enquanto faltar `responsavel_visita`** (já é validado, só falta refletir no `disabled`):
```diff
- disabled={!form.nome_cliente.trim() || !form.data_visita || submitting || (isParceria && !parceiroId)}
+ disabled={
+   !form.nome_cliente.trim() ||
+   !form.data_visita ||
+   !form.responsavel_visita ||
+   (mode === "create" && !UUID_REGEX.test(form.pipeline_lead_id)) ||
+   submitting ||
+   (isParceria && !parceiroId)
+ }
```

**5. Mensagem de erro inline visível** — quando o usuário tenta clicar mas falta lead, mostrar texto abaixo do search ("Selecione um lead da lista para continuar") ao invés de só toast.

### Diagnóstico extra (se após o fix o erro persistir)
Adicionar `console.error` mais detalhado em `useVisitas.createVisita` já está presente (linhas 363-377) — capturando `error.message`, `code`, `hint`, `details`. Depois do deploy do fix, pedir ao corretor para reproduzir e verificamos console.

### Fora de escopo (não tocar)
- Schema `visitas`, RLS, triggers (estão OK).
- Hook `useVisitas` (validações estão corretas).
- `ReuniaoNegocioForm.tsx` (fluxo de Reunião de Negócio é separado, não é o que o corretor usa no pipeline).
- Backend, RPCs, edge functions.

### Critérios de aceite
1. Trocar cliente limpa todos os campos do cliente anterior.
2. Combobox de empreendimento some quando o Jetimob ou form.empreendimento estiver preenchido.
3. Dropdown "Local da Visita" abre dentro da tela em viewport 440px.
4. Botão "Agendar Visita" fica desabilitado até todos os obrigatórios estarem OK (sem toast surpresa).
5. Build limpo, zero hex inline, sem mexer em design tokens.

Aguardo aprovação para executar.