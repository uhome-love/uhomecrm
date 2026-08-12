import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// Inline plugin: generates /version.json with build timestamp
function versionPlugin(): Plugin {
  return {
    name: "version-json",
    writeBundle(options) {
      const outDir = options.dir || "dist";
      fs.writeFileSync(
        path.join(outDir, "version.json"),
        JSON.stringify({ v: Date.now() })
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "production" && versionPlugin(),
  ].filter(Boolean),
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Função (e não objeto) de propósito: a forma em objeto arrasta as
        // DEPENDÊNCIAS do pacote listado para dentro do chunk (ex.: clsx ia
        // parar no vendor-charts), o que forçava o bundle inicial a importar
        // 412 KB de recharts em páginas públicas como /vaga.
        manualChunks(id: string) {
          // Helper virtual do plugin CommonJS: fixa no chunk base, senão o
          // Rollup o coloca dentro de um vendor pesado e obriga o preload dele.
          if (id.includes("commonjsHelpers")) return "vendor-react";
          if (!id.includes("node_modules")) return;
          const m = id.split("node_modules/").pop() || "";
          const pkg = m.startsWith("@")
            ? m.split("/").slice(0, 2).join("/")
            : m.split("/")[0];

          // Utilitários minúsculos compartilhados: fixados no chunk base para
          // não serem absorvidos por um vendor pesado (ex.: clsx no charts).
          if (["clsx", "tailwind-merge", "class-variance-authority"].includes(pkg))
            return "vendor-react";
          if (["react", "react-dom", "react-router-dom", "react-router", "scheduler"].includes(pkg))
            return "vendor-react";
          if (pkg === "@supabase" || pkg.startsWith("@supabase/")) return "vendor-supabase";
          if (pkg === "@tanstack/react-query" || pkg === "@tanstack/query-core") return "vendor-query";
          if (pkg === "framer-motion") return "vendor-motion";
          if (pkg === "sonner") return "vendor-sonner";
          if (
            pkg === "recharts" ||
            pkg === "victory-vendor" ||
            pkg.startsWith("d3-") ||
            pkg === "internmap" ||
            pkg === "delaunator" ||
            pkg === "robust-predicates"
          )
            return "vendor-charts";
          if (pkg === "date-fns") return "vendor-date";
          if (pkg === "papaparse" || pkg === "xlsx") return "vendor-spreadsheet";
          if (pkg.startsWith("@radix-ui/")) return "vendor-radix";
          if (pkg === "react-markdown") return "vendor-markdown";
        },
      },
    },
  },
}));
