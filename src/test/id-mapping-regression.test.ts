/**
 * Regressão de mapeamento de IDs.
 *
 * Garante que arquivos onde já corrigimos o uso de `user.id` em queries
 * contra tabelas que usam profiles.id NÃO voltem a regredir.
 *
 * Mapa canônico: mem://arquitetura/database/id-mapping-logic
 *
 * Tabelas que usam profiles.id (proibido `user.id` direto):
 *   negocios, whatsapp_*, roleta_distribuicoes/fila/credenciamentos,
 *   academia_*, lead_progressao, pos_vendas, corretor_calendar_integrations
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

interface Rule {
  file: string;
  table: string;
  column: string;
  description: string;
}

const RULES: Rule[] = [
  {
    file: "src/hooks/useCalendarIntegration.ts",
    table: "corretor_calendar_integrations",
    column: "corretor_id",
    description: "calendar integration usa profiles.id",
  },
  {
    file: "src/hooks/useSmartAlerts.ts",
    table: "negocios",
    column: "gerente_id",
    description: "negocios.gerente_id usa profiles.id",
  },
  {
    file: "src/hooks/useForecast.ts",
    table: "negocios",
    column: "gerente_id",
    description: "forecast: negocios.gerente_id usa profiles.id",
  },
  {
    file: "src/components/central/FunilContent.tsx",
    table: "negocios",
    column: "gerente_id",
    description: "FunilContent: negocios.gerente_id usa profiles.id",
  },
  {
    file: "src/components/central/ReportsContent.tsx",
    table: "negocios",
    column: "gerente_id",
    description: "ReportsContent: negocios.gerente_id usa profiles.id",
  },
];

// Padrões considerados "auth.users.id" — proibidos quando a tabela usa profiles.id
const FORBIDDEN_PATTERNS = [
  /\.eq\(["']%COL%["'],\s*user\.id/,
  /\.eq\(["']%COL%["'],\s*user!\.id/,
  /\.eq\(["']%COL%["'],\s*user\?\.id/,
  /\.eq\(["']%COL%["'],\s*authId/,
];

function blockFromQuery(content: string, table: string): string[] {
  // Encontra cada `.from("table")` e captura ~6 linhas seguintes (cobre chains)
  const blocks: string[] = [];
  const re = new RegExp(`\\.from\\(["']${table}["']\\)`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const start = m.index;
    // próximas 400 chars cobrem cadeia típica
    blocks.push(content.slice(start, start + 400));
  }
  return blocks;
}

describe("ID mapping regression — não voltar a usar user.id em tabela profiles.id", () => {
  for (const rule of RULES) {
    it(`${rule.file} → ${rule.table}.${rule.column}: ${rule.description}`, () => {
      const full = path.resolve(process.cwd(), rule.file);
      expect(fs.existsSync(full), `arquivo não existe: ${rule.file}`).toBe(true);
      const content = fs.readFileSync(full, "utf-8");
      const blocks = blockFromQuery(content, rule.table);
      expect(blocks.length, `nenhuma query .from('${rule.table}') encontrada`).toBeGreaterThan(0);

      const violations: string[] = [];
      for (const block of blocks) {
        for (const tmpl of FORBIDDEN_PATTERNS) {
          const pattern = new RegExp(tmpl.source.replace("%COL%", rule.column));
          if (pattern.test(block)) {
            violations.push(`Bloco proibido: ...${block.slice(0, 200)}...`);
          }
        }
      }
      expect(violations, violations.join("\n")).toEqual([]);
    });
  }
});
