import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
export default defineConfig({
  root: "/dev-server",
  plugins: [react(), {
    name: "stats",
    generateBundle(_o: any, b: any) {
      const out: string[] = [];
      for (const [k, c] of Object.entries<any>(b)) {
        if (c.type !== "chunk") continue;
        out.push(`### ${k} entry=${!!c.isEntry} imports=${JSON.stringify(c.imports)}`);
        if (c.isEntry) out.push(Object.keys(c.modules).join("\n"));
      }
      fs.writeFileSync("/tmp/stats.txt", out.join("\n"));
    },
  }],
  resolve: { dedupe: ["react","react-dom"], alias: { "@": path.resolve("/dev-server", "./src") } },
  build: { outDir: "/tmp/dist-stats", rollupOptions: { output: { manualChunks: { "vendor-charts": ["recharts"] } } } },
});
