/** Abas "Visão geral" | "Performance da Roleta" nos painéis do CEO, diretora e gerente. */
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PerformanceRoletaTab from "./PerformanceRoletaTab";

export default function PainelComAbas({ children, mobileHeader }: { children: ReactNode; mobileHeader?: ReactNode }) {
  return (
    <Tabs defaultValue="geral" className="w-full">
      {mobileHeader && <div className="md:hidden">{mobileHeader}</div>}
      <div className="px-4 pt-4 md:px-6">
        <TabsList className="grid h-auto w-full grid-cols-[1fr_1.65fr] gap-1 rounded-xl md:inline-flex md:h-10 md:w-auto md:gap-0 md:rounded-md">
          <TabsTrigger value="geral" className="min-h-11 min-w-0 whitespace-normal rounded-lg px-1 text-xs leading-snug md:min-h-0 md:whitespace-nowrap md:rounded-sm md:px-3 md:text-sm">Visão geral</TabsTrigger>
          <TabsTrigger value="performance" className="min-h-11 min-w-0 whitespace-normal rounded-lg px-1 text-xs leading-snug md:min-h-0 md:whitespace-nowrap md:rounded-sm md:px-3 md:text-sm">Performance da Roleta</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="geral" className="mt-0">{children}</TabsContent>
      <TabsContent value="performance" className="px-4 pb-6 md:px-6"><PerformanceRoletaTab /></TabsContent>
    </Tabs>
  );
}
