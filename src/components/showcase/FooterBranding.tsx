interface FooterBrandingProps {
  corretorNome?: string;
  brandSuffix?: string;
}

export default function FooterBranding({ corretorNome, brandSuffix }: FooterBrandingProps) {
  return (
    <footer className="py-8 border-t border-slate-100 bg-white">
      <div className="max-w-6xl mx-auto px-4 text-center">
        <p className="text-sm text-slate-400">
          Seleção personalizada por <span className="font-semibold text-slate-600">{corretorNome || "UHome"}</span>
        </p>
        <p className="text-xs text-slate-300 mt-1">UHome Sales{brandSuffix ? ` • ${brandSuffix}` : ""}</p>
      </div>
    </footer>
  );
}
