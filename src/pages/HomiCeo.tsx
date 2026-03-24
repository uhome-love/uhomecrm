import HomiCeoChat from "@/components/homi/HomiCeoChat";
import { PageHeader } from "@/components/ui/PageHeader";
import { Bot } from "lucide-react";

export default function HomiCeo() {
  return (
    <div className="bg-[#f0f0f5] dark:bg-[#0f0f12] p-6 -m-6 min-h-full space-y-4">
      <PageHeader
        title="HOMI CEO"
        subtitle="Análise semanal de performance · IA estratégica"
        icon={<Bot size={18} strokeWidth={1.5} />}
      />
      <HomiCeoChat />
    </div>
  );
}
