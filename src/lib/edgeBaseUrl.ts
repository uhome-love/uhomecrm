// Base URL para chamadas diretas a edge functions.
// ⚠️ BYPASS TEMPORÁRIO — propagação DNS Cloudflare (IONOS → CF).
// Apontando direto para Supabase enquanto api.uhomesales.com não propaga em
// alguns DNS residenciais (Vivo Fibra). REVERTER: trocar para
// "https://api.uhomesales.com" quando nslookup api.uhomesales.com (sem @1.1.1.1)
// retornar IP correto.
const USE_DIRECT_SUPABASE = true;
export const EDGE_BASE_URL = USE_DIRECT_SUPABASE
  ? "https://hunbxqzhvuemgntklyzb.supabase.co"
  : "https://api.uhomesales.com";
