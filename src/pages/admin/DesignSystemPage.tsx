import { useState } from "react";
import { Building2, Megaphone, Users, Bell, Activity, Palette, Moon, Sun } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import {
  StatCard, Panel, SectionHeader, Segmented, FilterChips, StatusPill, BarList, FunnelBars,
  StageFunnel, DataTable, Meter, HealthDots, HomiInsight, MetricList, AlertList,
} from "@/components/ds";

/** Vitrine interna das peças do DS v4 (só admin). Dados fictícios, nada lê nem grava no CRM. */
export default function DesignSystemPage() {
  const [seg, setSeg] = useState("geral");
  const [chip, setChip] = useState("todos");
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const trocarTema = () => {
    document.documentElement.classList.toggle("dark");
    setDark(document.documentElement.classList.contains("dark"));
  };

  return (
    <div className="space-y-8 p-6 md:p-8">
      <PageHeader
        title="Peças da marca"
        subtitle="Conferência interna do design system · dados de exemplo"
        icon={<Palette className="h-5 w-5" />}
        actions={
          <Button variant="outline" size="sm" onClick={trocarTema}>
            {dark ? <Sun className="mr-1.5 h-4 w-4" /> : <Moon className="mr-1.5 h-4 w-4" />}
            {dark ? "Tema claro" : "Tema escuro"}
          </Button>
        }
      />

      <section className="space-y-3">
        <SectionHeader title="Botões e navegação" note="Uma ação principal por tela" />
        <div className="flex flex-wrap items-center gap-3">
          <Button>Nova tarefa</Button>
          <Button variant="outline">Baixar PDF</Button>
          <Button variant="ghost">Cancelar</Button>
          <Segmented
            value={seg}
            onChange={setSeg}
            options={[{ id: "geral", label: "Visão geral" }, { id: "roleta", label: "Performance da roleta" }]}
          />
        </div>
        <FilterChips
          value={chip}
          onChange={setChip}
          options={[
            { id: "todos", label: "Todos", count: 42 },
            { id: "dia", label: "Em dia", count: 30, tone: "success" },
            { id: "atencao", label: "Atenção", count: 8, tone: "warning" },
            { id: "atraso", label: "Atrasados", count: 4, tone: "danger" },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="success">Realizada</StatusPill>
          <StatusPill tone="warning">A realizar</StatusPill>
          <StatusPill tone="danger">No-show</StatusPill>
          <StatusPill tone="primary">Proposta enviada</StatusPill>
          <StatusPill>Sem contato</StatusPill>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Números" icon={Activity} note="Até 5 por linha; tom só quando é status" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Leads gerados" value="20" accent sub="Meta, TikTok, LP" onClick={() => {}} delta={{ value: "12%", direction: "up", good: "up", label: "vs. ontem" }} />
          <StatCard label="Reaproveitados" value="3" sub="Oferta ativa" />
          <StatCard label="Realizadas" value="9" tone="success" />
          <StatCard label="A realizar" value="14" tone="warning" />
          <StatCard label="No-show" value="5" tone="danger" delta={{ value: "150%", direction: "up", good: "down", label: "vs. ontem" }} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard size="sm" label="Lead → visita" value="15,8%" sub="3 de 19 leads" />
          <StatCard size="sm" label="Visita → proposta" value="22,2%" sub="2 de 9 visitas" />
          <StatCard size="sm" label="Proposta → contrato" value="50,0%" sub="1 de 2" />
          <StatCard size="sm" label="Contrato → ganho" value="—" sub="Sem base no período" />
        </div>
      </section>

      <HomiInsight action="Ver os 13 leads" alert>
        13 dos 19 leads de hoje ainda estão em Sem contato.
      </HomiInsight>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="Leads por empreendimento" icon={Building2}>
          <BarList limit={4} items={[
            { label: "Open Arvoredo", value: 6 }, { label: "Open Bosque", value: 5 },
            { label: "Casa Tua Porto Alegre", value: 5 }, { label: "Essence Canoas", value: 4 },
            { label: "Lake Victoria", value: 2 }, { label: "Skyglass", value: 1 },
          ]} />
        </Panel>
        <Panel title="Leads por origem" icon={Megaphone}>
          <BarList items={[{ label: "Instagram", value: 19 }, { label: "Facebook", value: 1 }]} />
        </Panel>
        <Panel title="Funil do pipeline" subtitle="Leads de exemplo pela etapa atual">
          <FunnelBars items={[
            { label: "Novo lead", value: 4 }, { label: "Sem contato", value: 13 },
            { label: "Atendimento", value: 2 }, { label: "Aquecimento", value: 0 },
            { label: "Visita", value: 0 }, { label: "Descarte", value: 1, tone: "danger" },
          ]} />
        </Panel>
      </section>

      <Panel title="Funil de negócios" subtitle="Foto atual do Pipeline">
        <StageFunnel
          note="Documentação, Proposta e Contrato são foto atual; Ganho é do período."
          steps={[
            { label: "Documentação", count: 11, value: "R$ 2,2 mi", disabled: true },
            { label: "Proposta", count: 10, value: "R$ 5,1 mi" },
            { label: "Contrato", count: 0, value: "R$ 0" },
            { label: "Ganho", count: 3, value: "R$ 1,9 mi", tone: "success" },
          ]}
        />
      </Panel>

      <Panel title="Saúde do CRM e visitas por equipe" icon={Users}>
        <DataTable
          rank
          legend="Bolinhas: em dia · atenção · atrasados"
          columns={[
            { key: "equipe", label: "Equipe" }, { key: "crm", label: "CRM (meta 80%)" },
            { key: "saude", label: "Saúde dos leads" }, { key: "vm", label: "Visitas marcadas", num: true },
            { key: "vr", label: "Visitas realizadas", num: true }, { key: "st", label: "Situação" },
          ]}
          rows={[
            { equipe: "Equipe A", crm: { meter: 91 }, saude: { dots: [42, 6, 2] }, vm: 18, vr: 11, st: { pill: { tone: "success", label: "Em dia" } } },
            { equipe: "Equipe B", crm: { meter: 74, goal: 80 }, saude: { dots: [30, 9, 7] }, vm: 12, vr: 6, st: { pill: { tone: "danger", label: "Abaixo da meta" } } },
            { equipe: "Equipe C", crm: { meter: 85, goal: 80 }, saude: { dots: [25, 4, 1] }, vm: 9, vr: 7, st: { pill: { tone: "success", label: "Em dia" } } },
          ]}
          total={{ equipe: { text: "Total", strong: true }, vm: 39, vr: 24 }}
        />
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <Meter value={55} goal={80} />
          <HealthDots values={[12, 3, 1]} showLabels />
        </div>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <MetricList title="Marketing" icon={Megaphone} action={{ label: "Abrir marketing" }} items={[
            { label: "Investimento no mês", value: "R$ 18,4 mil" }, { label: "Custo por lead", value: "R$ 21,30" },
            { label: "Leads sem empreendimento", value: 2, tone: "warning" },
          ]} />
        </Panel>
        <Panel>
          <AlertList title="Alertas e atenção" icon={Bell} items={[
            { tone: "danger", text: "4 leads sem primeiro contato há mais de 1 dia", sub: "Carteira toda" },
            { tone: "warning", text: "No-show subiu 150% vs. ontem" },
          ]} />
          <div className="mt-4">
            <AlertList title="Exemplo vazio" items={[]} emptyText="Operação saudável" emptySub="Checado: leads parados há mais de 7 dias na carteira." />
          </div>
        </Panel>
      </section>
    </div>
  );
}
