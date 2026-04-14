import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Settings, FileText, BarChart3 } from "lucide-react";
import EmailSettingsTab from "@/components/email/EmailSettingsTab";
import EmailTemplatesTab from "@/components/email/EmailTemplatesTab";
import EmailCampaignsTab from "@/components/email/EmailCampaignsTab";

export default function EmailMarketingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Marketing"
        subtitle="Campanhas, templates e configurações de email"
        icon={<Mail size={18} strokeWidth={1.5} />}
      />

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Campanhas
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Templates
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4">
          <EmailCampaignsTab />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <EmailTemplatesTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <EmailSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
