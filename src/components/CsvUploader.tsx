import { useCallback, useRef, useState } from "react";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import type { LeadCSVRow } from "@/types/lead";

interface CsvUploaderProps {
  onDataParsed: (data: LeadCSVRow[], headers: string[]) => void;
}

export default function CsvUploader({ onDataParsed }: CsvUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      Papa.parse<LeadCSVRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields ?? [];
          onDataParsed(results.data, headers);
        },
      });
    },
    [onDataParsed]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`relative rounded-xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/40 hover:bg-muted/50"
        }`}
      >
        <AnimatePresence mode="wait">
          {fileName ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                <FileSpreadsheet className="h-7 w-7 text-accent" />
              </div>
              <p className="font-medium text-foreground">{fileName}</p>
              <p className="text-sm text-muted-foreground">Arquivo carregado com sucesso</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFileName(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                <X className="mr-1 h-4 w-4" /> Remover
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Upload className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  Arraste seu arquivo CSV aqui
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  ou clique para selecionar da sua máquina
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => inputRef.current?.click()}
              >
                Selecionar arquivo
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
    </motion.div>
  );
}
