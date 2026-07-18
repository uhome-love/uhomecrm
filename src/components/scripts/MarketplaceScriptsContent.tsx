// Wrapper leve — reusa a página do Marketplace como conteúdo embutido no hub /scripts.
import MarketplacePage from "@/pages/MarketplaceScripts";

export default function MarketplaceScriptsContent() {
  return <MarketplacePage showHeader={false} />;
}
