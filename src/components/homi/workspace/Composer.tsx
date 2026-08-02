import { forwardRef } from "react";
import { Send, Loader2, Paperclip, FileText, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { HomiAnexo } from "@/contexts/HomiContext";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isLoading: boolean;
  subindo: boolean;
  anexos: HomiAnexo[];
  onRemoveAnexo: (i: number) => void;
  onPickFiles: (files: File[]) => void;
  isMobile: boolean;
  fileRef: React.RefObject<HTMLInputElement>;
}

/** Caixa de comando única: anexo, texto e envio dentro da mesma superfície. */
const Composer = forwardRef<HTMLTextAreaElement, Props>(function Composer(
  { value, onChange, onSend, isLoading, subindo, anexos, onRemoveAnexo, onPickFiles, isMobile, fileRef },
  ref
) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-2xl border border-border bg-card shadow-sm transition-shadow focus-within:border-primary/40 focus-within:shadow-md focus-within:ring-2 focus-within:ring-primary/15">
        {anexos.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {anexos.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2 py-1 text-xs animate-scale-in"
              >
                {a.tipo.startsWith("image/") ? (
                  <ImageIcon className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-primary" />
                )}
                <span className="max-w-[160px] truncate">{a.nome}</span>
                <button type="button" onClick={() => onRemoveAnexo(i)} aria-label={`Remover ${a.nome}`}>
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={isMobile ? "Pergunte ou peça uma ação..." : "Pergunte, peça uma mensagem ou uma ação no CRM..."}
          rows={1}
          className="max-h-40 min-h-[52px] resize-none border-0 bg-transparent px-4 pt-3.5 text-sm shadow-none focus-visible:ring-0"
        />

        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex items-center gap-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                const fs = Array.from(e.target.files ?? []);
                e.target.value = "";
                onPickFiles(fs);
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground"
              onClick={() => fileRef.current?.click()}
              disabled={isLoading || subindo}
              aria-label="Anexar imagem ou PDF"
            >
              {subindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </Button>
            {!isMobile && (
              <span className="text-[11px] text-muted-foreground">Enter envia · Shift+Enter quebra linha</span>
            )}
          </div>

          <Button
            onClick={onSend}
            disabled={isLoading || (!value.trim() && anexos.length === 0)}
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            aria-label="Enviar"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
});

export default Composer;
