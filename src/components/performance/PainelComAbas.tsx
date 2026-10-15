/** Abas "Visão geral" | "Performance da Roleta" nos painéis do CEO, diretora e gerente. */
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PerformanceRoletaTab from "./PerformanceRoletaTab";

export default function PainelComAbas({ children }: { children: ReactNode }) {
  return (
    <Tabs defaultValue="geral" className="w-full">
      <div className="px-4 pt-4 md:px-6">
        <TabsList>
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="performance">Performance da Roleta</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="geral" className="mt-0">{children}</TabsContent>
      <TabsContent value="performance" className="px-4 pb-6 md:px-6"><PerformanceRoletaTab /></TabsContent>
    </Tabs>
  );
}
