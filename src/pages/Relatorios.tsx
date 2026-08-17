import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import RelatorioGeral from "@/pages/RelatorioGeral";
import RaioXCorretorPage from "@/pages/RaioXCorretorPage";

/**
 * Relatorios — a página única de relatórios do CRM, em 2 abas:
 *   • Raio-X do Time     → visão por equipe (RelatorioGeral: raio-x + conversão + PDF)
 *   • Raio-X do Corretor → visão individual (RaioXCorretorPage: cards + PDF)
 *
 * Escopo por papel:
 *   - CEO/Diretora (admin/diretor): as duas abas, selecionam qualquer equipe/corretor.
 *   - Gerente (gestor): as duas abas, só sua equipe/corretores (RLS + seletores).
 *   - Corretor: SÓ a aba Raio-X do Corretor, travada nele mesmo.
 * (O escopo real dos dados é garantido por RLS + pelos seletores de cada aba.)
 */

type Aba = "time" | "corretor";

const REL_STYLE = `
  .relwrap{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,system-ui,sans-serif;}
  .relwrap .rel-tabs{display:inline-flex;gap:4px;background:#EEF2F8;border:1px solid #E4E9F1;border-radius:12px;padding:4px;margin-bottom:18px;}
  .relwrap .rel-tabs button{border:0;background:transparent;color:#5B6B7F;font:inherit;font-size:13.5px;font-weight:750;padding:9px 18px;border-radius:9px;cursor:pointer;transition:.15s;}
  .relwrap .rel-tabs button.on{background:#fff;color:#2E44C7;box-shadow:0 1px 2px rgba(16,27,45,.06),0 6px 16px rgba(16,27,45,.06);}
  .relwrap .rel-load{padding:60px;text-align:center;color:#93A0B2;font-size:13px;}
  @media print{ .rel-tabs{display:none !important;} }
`;

export default function Relatorios() {
  const { isGestor, loading } = useUserRole();
  const [abaManual, setAbaManual] = useState<Aba | null>(null);

  // Corretor puro: sempre a aba do corretor. Gestão: default "time", troca no clique.
  const aba: Aba = !isGestor ? "corretor" : (abaManual ?? "time");

  if (loading) {
    return <div className="relwrap"><style>{REL_STYLE}</style><div className="rel-load">Carregando relatórios…</div></div>;
  }

  return (
    <div className="relwrap">
      <style>{REL_STYLE}</style>
      {isGestor && (
        <div className="rel-tabs rel-noprint">
          <button className={aba === "time" ? "on" : ""} onClick={() => setAbaManual("time")}>Raio-X do Time</button>
          <button className={aba === "corretor" ? "on" : ""} onClick={() => setAbaManual("corretor")}>Raio-X do Corretor</button>
        </div>
      )}
      {aba === "time" ? <RelatorioGeral /> : <RaioXCorretorPage />}
    </div>
  );
}
