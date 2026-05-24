/**
 * ModoTimeHeader — título + switcher Meu Time/Meus Leads.
 */
import ModoTimeSwitcher, { type ModoTimeView } from "./ModoTimeSwitcher";

interface Props {
  view: ModoTimeView;
  onViewChange: (v: ModoTimeView) => void;
  hasOwnLeads: boolean;
  subtitle?: string;
}

export default function ModoTimeHeader({ view, onViewChange, hasOwnLeads, subtitle }: Props) {
  return (
    <div className="flex items-end justify-between gap-4 px-1">
      <div>
        <h2 className="text-lg font-bold text-[#0A0E1A]">Modo Time</h2>
        {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
      <ModoTimeSwitcher value={view} onChange={onViewChange} hasOwnLeads={hasOwnLeads} />
    </div>
  );
}
