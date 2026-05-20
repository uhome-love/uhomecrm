/**
 * Shim de compatibilidade — Sprint 1 R3-V2 (2026-05-20).
 * O componente real vive em ./task-completion/TaskCompletionDialog.tsx.
 * Mantido para não quebrar imports antigos `@/components/pipeline/TaskCompletionDialog`.
 */
export { default } from "./task-completion/TaskCompletionDialog";
export type { TaskCompletionDialogProps } from "./task-completion/TaskCompletionDialog";
export type {
  CompletionPayload,
  NovaTarefaPayload,
  TipoContato,
  Resultado,
  TipoProximaTarefa,
} from "./task-completion/types";
