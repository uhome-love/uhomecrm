## Escopo aprovado

- Presets manuais aprovados (10 do catálogo).
- **Não mexer** em Sem contato e Visita — automações atuais permanecem intactas.
- Status de Qualificação e Negociação viram **display-only**, derivados do preset. Escape hatch em menu "…".
- Bugfix do card Perfil do lead antes de tudo.

---

## Fase A — Bugfix do card Perfil (isolado, primeiro)

Arquivo: `src/components/pipeline/QualificacaoChecklistCard.tsx` (`PerfilLeadCard`).

1. **Bug do reset durante edição**: trocar o `useEffect` que observa `initialTipologia/Faixa/Forma/Prazo/Bairros/Outro` por hidratação única na transição `editing: false → true` (via `useRef` guardando o último `editing` visto). Enquanto o popover está aberto, mudanças de `lead` no pai não sobrescrevem mais o formulário.
2. **Race no merge de `flag_status`**: no `handleSave`, re-buscar `flag_status` do banco imediatamente antes do `update` e fazer o merge sobre o valor fresco. Evita perder `status_atendimento`/`status_negociacao` gravados por outra aba/dispositivo enquanto o popover estava aberto.
3. **Contador "N/5"**: manter a lógica atual (bairro conta 1 se tem canônico OU outro), só ajustar o texto para "Bairro / região" pra ficar consistente com o label do campo.

Validação ao vivo: abrir lead, editar cada campo, salvar, reabrir, confirmar persistência. Fazer o teste com um segundo lead sofrendo `pipeline-reload` no meio da edição (disparar mudança em outra aba) — o formulário não pode ser resetado.

---

## Fase B — Catálogo de presets como biblioteca

Novo arquivo `src/lib/taskPresets.ts` exportando:

```ts
export type PresetKey =
  | "alinhar_perfil" | "buscar_imoveis" | "enviar_imoveis"
  | "follow_up" | "alinhando_visita" | "retomar_contato"
  | "enviar_proposta" | "aprovacao_bancaria" | "documentacao"
  | "outro";

export interface TaskPreset {
  key: PresetKey;
  label: string;              // ex.: "Enviar imóveis"
  tipo: "ligacao" | "whatsapp" | "email" | "tarefa" | "follow_up";
  diasDefault: number;
  horaDefault: string;        // "10:00"
  stages: Array<"qualificacao" | "aquecimento" | "negociacao" | "contrato">;
  syncStatus?: { key: "status_atendimento" | "status_negociacao"; value: string };
}

export const TASK_PRESETS: readonly TaskPreset[];
export function presetsForStage(tipo: string): TaskPreset[];
export function buildTaskFromPreset(p: TaskPreset, base?: { hora?: string; obs?: string }): {
  tipo: string; titulo: string; vence_em: string; hora_vencimento: string;
  origem: "manual_preset"; subtipo: PresetKey; descricao?: string;
};
```

Nenhuma UI muda ainda. Só a lib + testes unitários dos mapas de status.

---

## Fase C — Componente `TaskPresetPicker`

Novo `src/components/pipeline/TaskPresetPicker.tsx`:

- Recebe `stageTipo` e `onPick(preset, overrides)`.
- Renderiza chips com o `label` do preset (só os que atendem `stages`).
- Chip "Outro…" abre um mini-form com título livre + tipo (mantém compatibilidade com hoje).
- Após pick, mostra um bloco compacto: `[data] [hora] [obs opcional]`, pré-preenchido com `diasDefault`.

Testes visuais no Storybook do próprio drawer.

---

## Fase D — Plug do picker (Qualificação, Aquecimento, Negociação, Contrato)

Três pontos de entrada substituem o form de "nova tarefa manual" pelo `TaskPresetPicker`:

- `src/components/pipeline/task-completion/CompletionForm.tsx` (bloco "Agendar próxima tarefa", quando `outcome='agendar'` e etapa ≠ visita/sem-contato).
- `src/components/pipeline/NextActionModal.tsx` (opção "Agendar nova tarefa").
- `src/components/pipeline/DrawerTasksTab.tsx` (botão "Nova tarefa" — só nas etapas afetadas).

Regras aplicadas em todos os três:
- Sem contato e Visita: **picker desabilitado**, mensagem "Tarefas automáticas nesta etapa". Mesmo comportamento de hoje.
- Insert grava `origem='manual_preset'`, `subtipo=<key>`, `titulo=preset.label` (formatação do título fica como hoje, com data/hora anexadas onde já é feito).

---

## Fase E — Status derivado do preset

No mesmo insert de tarefa (Fase D), quando `preset.syncStatus` existe:

```ts
if (preset.syncStatus) {
  const { data: fresh } = await supabase
    .from("pipeline_leads").select("flag_status").eq("id", leadId).single();
  const merged = { ...(fresh?.flag_status || {}), [preset.syncStatus.key]: preset.syncStatus.value };
  await supabase.from("pipeline_leads").update({ flag_status: merged }).eq("id", leadId);
}
```

Frontend:
- `QualificacaoEtapaCard` vira display-only — as pills não são mais `<button>`, ficam como badges. Título muda para "Status atual" com badge "automático".
- Menu "…" ao lado da pill ativa (`Corrigir manualmente`) abre um popover simples com as 6 opções de `QUALIFICACAO_STATUS_ATEND` — grava direto sem criar tarefa, para casos-limite.
- Mesmo padrão em Negociação (`status_negociacao`).

Etapas Aquecimento (`prazo`) e Contrato (`status_contrato`) **não** entram nesse ciclo agora — o preset `retomar_contato` do Aquecimento não escreve `prazo` porque a escolha de 30/60/90 é semanticamente diferente (é o corretor definindo o prazo, não uma consequência da ação).

---

## Fase F — Validação ao vivo em lead de teste

Um por um, sem quebrar:

1. Abrir lead em Qualificação, agendar preset `alinhar_perfil` → confirmar tarefa criada + pill mostra "Alinhamento de perfil" + histórico registra tudo corretamente.
2. Repetir para `buscar_imoveis`, `enviar_imoveis`, `follow_up`, `alinhando_visita`.
3. Testar override via menu "…" (marca `envio_opcoes` sem criar tarefa) → só a pill muda.
4. Mover lead pra Aquecimento → picker mostra `retomar_contato`, `follow_up`, `enviar_imoveis`, `outro`. Testar `retomar_contato` → confirma que `prazo` NÃO foi sobrescrito automaticamente.
5. Mover pra Negociação → testar `enviar_proposta`, `aprovacao_bancaria`, `documentacao` — cada um seta `status_negociacao` correspondente.
6. Abrir lead em Sem contato e em Visita → confirmar que o picker está desabilitado, com mensagem clara. Tarefas automáticas dessas etapas não podem ter regredido.
7. Card do Kanban continua mostrando o label da próxima tarefa correto em todos os cenários (código atual já lê `titulo`/`subtipo`).

---

## Fora de escopo

- Nenhuma migração de schema (todos os campos já existem: `origem`, `subtipo`, `flag_status`, `faixa_valor`, `forma_pagamento`, `prazo_decisao`, `bairro_regiao`).
- Automações Sem-contato e Visita.
- Aquecimento não ganha status derivado.
- Nenhum job de backfill — presets só afetam tarefas criadas daqui pra frente.

---

## O que preciso antes de começar

Só confirmar: **Fase A (bugfix do Perfil) faço isolada primeiro**, você valida ao vivo, e só depois eu parto pra B→F? Ou pode tocar A→F em sequência sem checkpoint intermediário?