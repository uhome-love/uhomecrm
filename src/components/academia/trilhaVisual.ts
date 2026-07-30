// Shared visual helpers for Academia trilhas (gradients / icons fallback)
export const TRILHA_GRADIENTS: Record<string, string> = {
  treinamento_sistema: "from-[#1e3a5f] to-[#0e7490]",
  empreendimentos: "from-emerald-700 to-emerald-500",
  tecnicas_vendas: "from-amber-700 to-orange-500",
  objecoes_scripts: "from-purple-700 to-pink-500",
  processos: "from-slate-700 to-blue-500",
};

export const TRILHA_ICONS: Record<string, string> = {
  treinamento_sistema: "🖥️",
  empreendimentos: "🏠",
  tecnicas_vendas: "📞",
  objecoes_scripts: "🎯",
  processos: "⚙️",
};

export const RAIL_ORDER: { key: string; label: string; hint: string }[] = [
  { key: "empreendimentos", label: "🏢 Empreendimentos", hint: "conheça o produto" },
  { key: "objecoes_scripts", label: "💬 Objeções e Scripts", hint: "o que falar em cada situação" },
  { key: "tecnicas_vendas", label: "📞 Técnicas de Vendas", hint: "do primeiro contato ao fechamento" },
  { key: "processos", label: "⚙️ Processos Uhome", hint: "como a casa funciona" },
  { key: "treinamento_sistema", label: "🖥️ Treinamento do Sistema", hint: "domine o CRM" },
];

/** Categorias legadas do banco → chaves canônicas dos carrosséis */
const CATEGORIA_ALIASES: Record<string, string> = {
  sistema: "treinamento_sistema",
  produto: "empreendimentos",
  vendas: "tecnicas_vendas",
  scripts: "objecoes_scripts",
  objecoes: "objecoes_scripts",
  processo: "processos",
};

export function normalizeCategoria(categoria?: string | null) {
  const c = categoria || "";
  return CATEGORIA_ALIASES[c] || c;
}

export function gradientOf(categoria?: string | null) {
  return TRILHA_GRADIENTS[normalizeCategoria(categoria)] || "from-slate-600 to-slate-800";
}

export function iconOf(categoria?: string | null) {
  return TRILHA_ICONS[normalizeCategoria(categoria)] || "📚";
}

export function isNova(createdAt?: string | null) {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
}
