import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, FileSignature, Loader2, Download, Search, Pencil } from "lucide-react";
import { formatCurrencyInput, handleCurrencyChange, parseCurrencyToNumber, numberToRawCurrency } from "@/utils/currencyFormat";

// ─── Máscaras de documentos/contato ────────────────────────────────────────────
const onlyDigits = (v: string) => v.replace(/\D/g, "");
const maskCPF = (v: string) =>
  onlyDigits(v).slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const maskCNPJ = (v: string) =>
  onlyDigits(v).slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
const maskTelefone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};
const maskRG = (v: string) => v.replace(/[^\dxX.-]/g, "").slice(0, 14);

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface CorretorOption {
  user_id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  creci: string | null;
}

interface CorretorForm {
  user_id: string;
  nome: string;
  cpf: string;
  rg: string;
  email: string;
  percentual: string; // %
}

interface CompradorForm {
  tipoPessoa: "PF" | "PJ";
  razaoSocial: string;
  cnpj: string;
  socioAdmin: string;
  nomeCompleto: string;
  genero: string;
  profissao: string;
  estadoCivil: string;
  regimeBens: string;
  cpf: string;
  rg: string;
  telefone: string;
  email: string;
  endereco: string;
}

const emptyComprador: CompradorForm = {
  tipoPessoa: "PF", razaoSocial: "", cnpj: "", socioAdmin: "",
  nomeCompleto: "", genero: "", profissao: "", estadoCivil: "", regimeBens: "",
  cpf: "", rg: "", telefone: "", email: "", endereco: "",
};

interface Parcela {
  vencimento: string; // yyyy-mm-dd
  valor: string;      // numérico
}

interface Testemunha {
  nome: string;
  email: string;
}

// Testemunha fixa disponível como atalho de preenchimento.
const CAROLINA: Testemunha = { nome: "Carolina de Camargo Madruga", email: "carolina@uhome.com.br" };

// ─── Helpers de cálculo (replicado na edge function) ───────────────────────────
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: string) => {
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDataCurta = (iso: string) => {
  if (!iso) return "--/--/--";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

interface CredorCalc {
  nome: string;
  isUhome: boolean;
  total: number;
  parcelas: number[];
}

function calcularCredores(
  valorTotal: number,
  corretores: { nome: string; pct: number }[],
  pctGabrielle: number,
  pctDiretoria: number,
  parcelas: number[],
): { credores: CredorCalc[]; totalLinha: number[]; zemo: { total: number; parcelas: number[] } } {
  const pctUhome = Math.max(0, 100 - corretores.reduce((s, c) => s + c.pct, 0) - pctGabrielle - pctDiretoria);

  const defs: { nome: string; pct: number; isUhome: boolean }[] = [
    ...corretores.map((c) => ({ nome: c.nome, pct: c.pct, isUhome: false })),
    { nome: "Gabrielle Rodrigues", pct: pctGabrielle, isUhome: false },
    { nome: "Diretoria", pct: pctDiretoria, isUhome: false },
    { nome: "UHome", pct: pctUhome, isUhome: true },
  ];

  const credores: CredorCalc[] = defs.map((d) => {
    const total = round2((d.pct / 100) * valorTotal);
    const ps: number[] = [];
    let acc = 0;
    parcelas.forEach((valorP, i) => {
      if (i === parcelas.length - 1) {
        ps.push(round2(total - acc));
      } else {
        const v = round2((d.pct / 100) * valorP);
        ps.push(v);
        acc = round2(acc + v);
      }
    });
    return { nome: d.nome, isUhome: d.isUhome, total, parcelas: ps };
  });

  const totalLinha = parcelas.map((_, i) =>
    round2(credores.reduce((s, c) => s + c.parcelas[i], 0)),
  );

  // ZemoBank recebe o total da corretagem (todos os credores, inclusive a UHome).
  const zemo = {
    total: round2(credores.reduce((s, c) => s + c.total, 0)),
    parcelas: totalLinha,
  };

  return { credores, totalLinha, zemo };
}

// ─── Formulário de um comprador (contratante) ──────────────────────────────────
function CompradorFields({
  value,
  onChange,
}: {
  value: CompradorForm;
  onChange: (patch: Partial<CompradorForm>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de pessoa</Label>
          <Select value={value.tipoPessoa} onValueChange={(v) => onChange({ tipoPessoa: v as "PF" | "PJ" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PF">Pessoa Física</SelectItem>
              <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {value.tipoPessoa === "PJ" ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Razão Social</Label><Input value={value.razaoSocial} onChange={(e) => onChange({ razaoSocial: e.target.value })} placeholder="Ex: Empresa Exemplo LTDA." /></div>
          <div className="space-y-2"><Label>CNPJ</Label><Input value={value.cnpj} onChange={(e) => onChange({ cnpj: maskCNPJ(e.target.value) })} inputMode="numeric" placeholder="00.000.000/0001-00" /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Nome do sócio-administrador</Label><Input value={value.socioAdmin} onChange={(e) => onChange({ socioAdmin: e.target.value })} placeholder="Ex: Carlos Souza" /></div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2"><Label>Nome completo</Label><Input value={value.nomeCompleto} onChange={(e) => onChange({ nomeCompleto: e.target.value })} placeholder="Ex: João da Silva Souza" /></div>
          <div className="space-y-2">
            <Label>Gênero</Label>
            <Select value={value.genero} onValueChange={(v) => onChange({ genero: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="feminino">Feminino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Profissão</Label><Input value={value.profissao} onChange={(e) => onChange({ profissao: e.target.value })} placeholder="Ex: Engenheiro" /></div>
          <div className="space-y-2">
            <Label>Estado civil</Label>
            <Select value={value.estadoCivil} onValueChange={(v) => onChange({ estadoCivil: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solteiro(a)">Solteiro(a)</SelectItem>
                <SelectItem value="casado(a)">Casado(a)</SelectItem>
                <SelectItem value="divorciado(a)">Divorciado(a)</SelectItem>
                <SelectItem value="viúvo(a)">Viúvo(a)</SelectItem>
                <SelectItem value="união estável">União estável</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {value.estadoCivil === "casado(a)" && (
            <div className="space-y-2"><Label>Regime de bens</Label><Input value={value.regimeBens} onChange={(e) => onChange({ regimeBens: e.target.value })} /></div>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>CPF</Label><Input value={value.cpf} onChange={(e) => onChange({ cpf: maskCPF(e.target.value) })} inputMode="numeric" placeholder="000.000.000-00" /></div>
        <div className="space-y-2"><Label>RG</Label><Input value={value.rg} onChange={(e) => onChange({ rg: maskRG(e.target.value) })} placeholder="0000000000" /></div>
        <div className="space-y-2"><Label>Telefone</Label><Input value={value.telefone} onChange={(e) => onChange({ telefone: maskTelefone(e.target.value) })} inputMode="numeric" placeholder="(51) 99999-9999" /></div>
        <div className="space-y-2"><Label>E-mail</Label><Input value={value.email} onChange={(e) => onChange({ email: e.target.value })} placeholder="nome@email.com" /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Endereço completo</Label><Input value={value.endereco} onChange={(e) => onChange({ endereco: e.target.value })} placeholder="Rua Exemplo, nº 123, Bairro, Porto Alegre/RS, CEP 90000-000" /></div>
      </div>
    </div>
  );
}

// ─── Componente ────────────────────────────────────────────────────────────────
export default function IntermediacaoPage() {
  // Comprador(es) — lista dinâmica (aquisição pode ter vários compradores)
  const MAX_COMPRADORES = 6;
  const [compradores, setCompradores] = useState<CompradorForm[]>([{ ...emptyComprador }]);
  const updateComprador = (idx: number, patch: Partial<CompradorForm>) =>
    setCompradores((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  const addComprador = () =>
    setCompradores((prev) => (prev.length >= MAX_COMPRADORES ? prev : [...prev, { ...emptyComprador }]));
  const removeComprador = (idx: number) =>
    setCompradores((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  // Imóvel
  const [empreendimento, setEmpreendimento] = useState("");
  const [unidade, setUnidade] = useState("");
  const [vgv, setVgv] = useState("");

  // Corretores
  const [opcoesCorretores, setOpcoesCorretores] = useState<CorretorOption[]>([]);
  const emptyCorretor: CorretorForm = { user_id: "", nome: "", cpf: "", rg: "", email: "", percentual: "" };
  const [corretor1, setCorretor1] = useState<CorretorForm>({ ...emptyCorretor });
  const [corretor2, setCorretor2] = useState<CorretorForm>({ ...emptyCorretor });
  const [usarCorretor2, setUsarCorretor2] = useState(false);

  // Comissão
  const [valorTotal, setValorTotal] = useState("");
  const [pctGabrielle, setPctGabrielle] = useState("10");
  const [pctDiretoria, setPctDiretoria] = useState("5");
  const [parcelas, setParcelas] = useState<Parcela[]>([{ vencimento: "", valor: "" }]);

  // Data do contrato
  const hoje = new Date().toISOString().slice(0, 10);
  const [dataContrato, setDataContrato] = useState(hoje);

  // Testemunhas (Testemunha 2 já vem com Carolina pré-preenchida)
  const [testemunha1, setTestemunha1] = useState<Testemunha>({ nome: "", email: "" });
  const [testemunha2, setTestemunha2] = useState<Testemunha>({ ...CAROLINA });

  const [gerando, setGerando] = useState(false);
  const [carregandoCorretores, setCarregandoCorretores] = useState(true);

  // Aba ativa (controlada, para permitir "Editar" a partir do histórico)
  const [aba, setAba] = useState("gerar");

  // Carrega um payload salvo de volta no formulário (fluxo de edição).
  const carregarIntermediacao = (p: any) => {
    if (!p) return;
    
    const mapComprador = (x: any): CompradorForm => ({
      tipoPessoa: x?.tipoPessoa === "PJ" ? "PJ" : "PF",
      razaoSocial: x?.razaoSocial ?? "",
      cnpj: x?.cnpj ?? "",
      socioAdmin: x?.socioAdmin ?? "",
      nomeCompleto: x?.nomeCompleto ?? "",
      genero: x?.genero ?? "",
      profissao: x?.profissao ?? "",
      estadoCivil: x?.estadoCivil ?? "",
      regimeBens: x?.regimeBens ?? "",
      cpf: x?.cpf ?? "",
      rg: x?.rg ?? "",
      telefone: x?.telefone ?? "",
      email: x?.email ?? "",
      endereco: x?.endereco ?? "",
    });
    // Compat: payloads antigos têm apenas `comprador`; os novos têm `compradores` (array).
    const comps = Array.isArray(p.compradores) && p.compradores.length
      ? p.compradores
      : [p.comprador ?? {}];
    const mapeados = comps.map((c: any) => mapComprador(c ?? {}));
    setCompradores(mapeados.length ? mapeados : [{ ...emptyComprador }]);

    const im = p.imovel ?? {};
    setEmpreendimento(im.empreendimento ?? "");
    setUnidade(im.unidade ?? "");
    setVgv(numberToRawCurrency(im.vgv ?? 0));

    const corrs = Array.isArray(p.corretores) ? p.corretores : [];
    const mapCorr = (x: any): CorretorForm => ({
      user_id: "",
      nome: x?.nome ?? "",
      cpf: x?.cpf ?? "",
      rg: x?.rg ?? "",
      email: x?.email ?? "",
      percentual: x?.percentual != null ? String(x.percentual) : "",
    });
    setCorretor1(corrs[0] ? mapCorr(corrs[0]) : { ...emptyCorretor });
    if (corrs[1]) { setUsarCorretor2(true); setCorretor2(mapCorr(corrs[1])); }
    else { setUsarCorretor2(false); setCorretor2({ ...emptyCorretor }); }

    const co = p.comissao ?? {};
    setValorTotal(numberToRawCurrency(co.valorTotal ?? 0));
    setPctGabrielle(co.pctGabrielle != null ? String(co.pctGabrielle) : "10");
    setPctDiretoria(co.pctDiretoria != null ? String(co.pctDiretoria) : "5");
    const pcs = Array.isArray(co.parcelas) ? co.parcelas : [];
    setParcelas(pcs.length ? pcs.map((x: any) => ({ vencimento: x?.vencimento ?? "", valor: numberToRawCurrency(x?.valor ?? 0) })) : [{ vencimento: "", valor: "" }]);

    const ts = Array.isArray(p.testemunhas) ? p.testemunhas : [];
    setTestemunha1(ts[0] ? { nome: ts[0].nome ?? "", email: ts[0].email ?? "" } : { nome: "", email: "" });
    setTestemunha2(ts[1] ? { nome: ts[1].nome ?? "", email: ts[1].email ?? "" } : { ...CAROLINA });

    setDataContrato(p.dataContrato ?? hoje);
    setAba("gerar");
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info("Dados carregados. Ajuste o que precisar e gere novamente.");
  };

  // Carregar corretores (via RPC SECURITY DEFINER — contorna RLS de user_roles p/ gestores)
  useEffect(() => {
    (async () => {
      setCarregandoCorretores(true);
      const { data, error } = await supabase.rpc("get_corretores_intermediacao");
      if (error) {
        toast.error("Erro ao carregar corretores: " + error.message);
        setCarregandoCorretores(false);
        return;
      }
      const opts = (data ?? [])
        .filter((p) => p.nome)
        .map((p) => ({
          user_id: p.user_id as string,
          nome: p.nome as string,
          cpf: p.cpf as string | null,
          email: p.email as string | null,
          creci: p.creci as string | null,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      setOpcoesCorretores(opts);
      setCarregandoCorretores(false);
    })();
  }, []);

  const selecionarCorretor = (
    userId: string,
    setter: React.Dispatch<React.SetStateAction<CorretorForm>>,
  ) => {
    const op = opcoesCorretores.find((o) => o.user_id === userId);
    setter((prev) => ({
      ...prev,
      user_id: userId,
      nome: op?.nome ?? "",
      cpf: op?.cpf ?? "",
      email: op?.email ?? "",
    }));
  };

  // Cálculo em tempo real
  const calc = useMemo(() => {
    const corretoresInput = [
      { nome: corretor1.nome || "Corretor 1", pct: num(corretor1.percentual) },
      ...(usarCorretor2 ? [{ nome: corretor2.nome || "Corretor 2", pct: num(corretor2.percentual) }] : []),
    ];
    const valoresParcelas = parcelas.map((p) => parseCurrencyToNumber(p.valor));
    return calcularCredores(
      parseCurrencyToNumber(valorTotal),
      corretoresInput,
      num(pctGabrielle),
      num(pctDiretoria),
      valoresParcelas,
    );
  }, [corretor1, corretor2, usarCorretor2, valorTotal, pctGabrielle, pctDiretoria, parcelas]);

  const somaPercentuais = useMemo(() => {
    const somaCorr = num(corretor1.percentual) + (usarCorretor2 ? num(corretor2.percentual) : 0);
    return somaCorr + num(pctGabrielle) + num(pctDiretoria);
  }, [corretor1, corretor2, usarCorretor2, pctGabrielle, pctDiretoria]);

  const pctUhome = useMemo(() => Math.max(0, 100 - somaPercentuais), [somaPercentuais]);
  const pctExcedido = somaPercentuais > 100 + 1e-9;

  // Aviso quando a soma das parcelas diverge do valor total da corretagem.
  const somaParcelas = useMemo(
    () => round2(parcelas.reduce((s, p) => s + parseCurrencyToNumber(p.valor), 0)),
    [parcelas],
  );
  const parcelasDivergem = parseCurrencyToNumber(valorTotal) > 0 && Math.abs(somaParcelas - parseCurrencyToNumber(valorTotal)) > 0.01;

  // Atalhos de preenchimento de testemunhas: Carolina + corretores/gerentes carregados.
  const opcoesTestemunha = useMemo<Testemunha[]>(() => {
    const lista: Testemunha[] = [{ ...CAROLINA }];
    opcoesCorretores.forEach((o) => {
      if (o.nome) lista.push({ nome: o.nome, email: o.email ?? "" });
    });
    return lista;
  }, [opcoesCorretores]);

  const preencherTestemunha = (
    nome: string,
    setter: React.Dispatch<React.SetStateAction<Testemunha>>,
  ) => {
    const op = opcoesTestemunha.find((o) => o.nome === nome);
    if (op) setter({ nome: op.nome, email: op.email });
  };

  const addParcela = () => setParcelas((p) => [...p, { vencimento: "", valor: "" }]);
  const removeParcela = (i: number) =>
    setParcelas((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));
  const updateParcela = (i: number, campo: keyof Parcela, valor: string) =>
    setParcelas((p) => p.map((par, idx) => (idx === i ? { ...par, [campo]: valor } : par)));

  const handleGerar = async () => {
    // validações básicas
    const validarComprador = (c: CompradorForm, rotulo: string): string | null => {
      if (c.tipoPessoa === "PF" && !c.nomeCompleto.trim()) return `Informe o nome completo do ${rotulo}.`;
      if (c.tipoPessoa === "PJ" && (!c.razaoSocial.trim() || !c.socioAdmin.trim())) return `Informe Razão Social e sócio-administrador do ${rotulo}.`;
      return null;
    };
    for (let i = 0; i < compradores.length; i++) {
      const rotulo = compradores.length > 1 ? `comprador ${i + 1}` : "comprador";
      const erro = validarComprador(compradores[i], rotulo);
      if (erro) return toast.error(erro);
    }
    if (!empreendimento.trim() || !unidade.trim()) return toast.error("Informe empreendimento e unidade.");
    if (!corretor1.user_id) return toast.error("Selecione o Corretor 1.");
    if (parseCurrencyToNumber(valorTotal) <= 0) return toast.error("Informe o valor total da corretagem.");
    if (pctExcedido) return toast.error("A soma dos percentuais (corretores + Gabrielle + Diretoria) ultrapassa 100%.");
    if (parcelas.some((p) => !p.vencimento || parseCurrencyToNumber(p.valor) <= 0)) return toast.error("Preencha todas as parcelas (vencimento e valor).");
    if (!testemunha1.nome.trim() || !testemunha1.email.trim()) return toast.error("Preencha nome e e-mail da Testemunha 1.");
    if (!testemunha2.nome.trim() || !testemunha2.email.trim()) return toast.error("Preencha nome e e-mail da Testemunha 2.");

    // Aviso não bloqueante: parcelas divergem do valor total.
    if (parcelasDivergem) {
      toast.warning(`Atenção: a soma das parcelas (${brl(somaParcelas)}) difere do valor total (${brl(parseCurrencyToNumber(valorTotal))}).`);
    }

    // Comprador: envia apenas os campos do tipo selecionado.
    const normalizarComprador = (c: CompradorForm) =>
      c.tipoPessoa === "PJ"
        ? {
            tipoPessoa: c.tipoPessoa, razaoSocial: c.razaoSocial, cnpj: c.cnpj, socioAdmin: c.socioAdmin,
            nomeCompleto: "", genero: "", profissao: "", estadoCivil: "", regimeBens: "",
            cpf: c.cpf, rg: c.rg, telefone: c.telefone, email: c.email, endereco: c.endereco,
          }
        : {
            tipoPessoa: c.tipoPessoa, razaoSocial: "", cnpj: "", socioAdmin: "",
            nomeCompleto: c.nomeCompleto, genero: c.genero, profissao: c.profissao, estadoCivil: c.estadoCivil,
            regimeBens: c.estadoCivil === "casado(a)" ? c.regimeBens : "",
            cpf: c.cpf, rg: c.rg, telefone: c.telefone, email: c.email, endereco: c.endereco,
          };

    const compradores = [
      normalizarComprador(comprador1),
      ...(usarComprador2 ? [normalizarComprador(comprador2)] : []),
    ];

    const payload = {
      comprador: compradores[0], // compat com consumidores antigos
      compradores,
      imovel: { empreendimento, unidade, vgv: parseCurrencyToNumber(vgv) },
      corretores: [
        { nome: corretor1.nome, cpf: corretor1.cpf, rg: corretor1.rg, email: corretor1.email, percentual: num(corretor1.percentual) },
        ...(usarCorretor2 && corretor2.user_id
          ? [{ nome: corretor2.nome, cpf: corretor2.cpf, rg: corretor2.rg, email: corretor2.email, percentual: num(corretor2.percentual) }]
          : []),
      ],
      comissao: {
        valorTotal: parseCurrencyToNumber(valorTotal),
        pctGabrielle: num(pctGabrielle),
        pctDiretoria: num(pctDiretoria),
        parcelas: parcelas.map((p) => ({ vencimento: p.vencimento, valor: parseCurrencyToNumber(p.valor) })),
      },
      testemunhas: [
        { nome: testemunha1.nome.trim(), email: testemunha1.email.trim() },
        { nome: testemunha2.nome.trim(), email: testemunha2.email.trim() },
      ],
      dataContrato,
    };


    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-intermediacao", { body: payload });
      if (error) throw error;
      if (!data?.base64 || !data?.filename) throw new Error("Resposta inválida do servidor.");

      const bin = atob(data.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Documento gerado com sucesso!");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao gerar o documento.";
      toast.error(msg);
    } finally {
      setGerando(false);
    }
  };

  const ACCENT = "#4F46E5";

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <header className="flex items-center gap-3">
        <FileSignature className="h-6 w-6" style={{ color: ACCENT }} />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Instrumento de Intermediação Imobiliária</h1>
          <p className="text-sm text-muted-foreground">Gere o contrato de intermediação da Uhome em .docx</p>
        </div>
      </header>

      <Tabs value={aba} onValueChange={setAba} className="space-y-6">
        <TabsList>
          <TabsTrigger value="gerar">Gerar Intermediação</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="gerar" className="space-y-6">


      {/* Comprador(es) */}
      <Card>
        <CardHeader><CardTitle className="text-base">Comprador (Contratante)</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {usarComprador2 && <Label className="font-medium">Comprador 1</Label>}
          <CompradorFields
            value={comprador1}
            onChange={(patch) => setComprador1((prev) => ({ ...prev, ...patch }))}
          />

          {!usarComprador2 ? (
            <Button variant="outline" size="sm" onClick={() => setUsarComprador2(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar segundo comprador
            </Button>
          ) : (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="font-medium">Comprador 2</Label>
                <Button variant="ghost" size="sm" onClick={() => { setUsarComprador2(false); setComprador2({ ...emptyComprador }); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <CompradorFields
                value={comprador2}
                onChange={(patch) => setComprador2((prev) => ({ ...prev, ...patch }))}
              />
            </div>
          )}
        </CardContent>
      </Card>


      {/* Imóvel */}
      <Card>
        <CardHeader><CardTitle className="text-base">Imóvel</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2 sm:col-span-2"><Label>Empreendimento</Label><Input value={empreendimento} onChange={(e) => setEmpreendimento(e.target.value)} placeholder="Ex: Shift Torre Residencial" /></div>
          <div className="space-y-2"><Label>Unidade</Label><Input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Ex: 1107" /></div>
          <div className="space-y-2 sm:col-span-3"><Label>VGV (valor do imóvel)</Label><Input value={formatCurrencyInput(vgv)} onChange={(e) => setVgv(handleCurrencyChange(e.target.value))} inputMode="numeric" placeholder="R$ 000.000,00" /></div>
        </CardContent>
      </Card>

      {/* Corretores */}
      <Card>
        <CardHeader><CardTitle className="text-base">Corretores</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {/* Corretor 1 */}
          <div className="space-y-3">
            <Label className="font-medium">Corretor 1</Label>
            <Select value={corretor1.user_id} onValueChange={(v) => selecionarCorretor(v, setCorretor1)} disabled={carregandoCorretores}>
              <SelectTrigger>
                <SelectValue placeholder={carregandoCorretores ? "Carregando corretores..." : "Buscar corretor..."} />
              </SelectTrigger>
              <SelectContent>
                {opcoesCorretores.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                    {carregandoCorretores ? "Carregando..." : "Nenhum corretor encontrado"}
                  </div>
                ) : (
                  opcoesCorretores.map((o) => <SelectItem key={o.user_id} value={o.user_id}>{o.nome}</SelectItem>)
                )}
              </SelectContent>
            </Select>
            <div className="grid sm:grid-cols-4 gap-3">
              <div className="space-y-1"><Label className="text-xs">CPF</Label><Input value={corretor1.cpf} onChange={(e) => setCorretor1({ ...corretor1, cpf: maskCPF(e.target.value) })} inputMode="numeric" placeholder="000.000.000-00" /></div>
              <div className="space-y-1"><Label className="text-xs">RG</Label><Input value={corretor1.rg} onChange={(e) => setCorretor1({ ...corretor1, rg: maskRG(e.target.value) })} placeholder="0000000000" /></div>
              <div className="space-y-1"><Label className="text-xs">E-mail</Label><Input value={corretor1.email} onChange={(e) => setCorretor1({ ...corretor1, email: e.target.value })} placeholder="nome@uhome.imb.br" /></div>
              <div className="space-y-1"><Label className="text-xs">% Comissão</Label><Input type="number" min={0} max={100} value={corretor1.percentual} onChange={(e) => setCorretor1({ ...corretor1, percentual: e.target.value })} /></div>
            </div>
          </div>

          {/* Corretor 2 */}
          {!usarCorretor2 ? (
            <Button variant="outline" size="sm" onClick={() => setUsarCorretor2(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar Corretor 2
            </Button>
          ) : (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="font-medium">Corretor 2</Label>
                <Button variant="ghost" size="sm" onClick={() => { setUsarCorretor2(false); setCorretor2({ ...emptyCorretor }); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Select value={corretor2.user_id} onValueChange={(v) => selecionarCorretor(v, setCorretor2)} disabled={carregandoCorretores}>
                <SelectTrigger>
                  <SelectValue placeholder={carregandoCorretores ? "Carregando corretores..." : "Buscar corretor..."} />
                </SelectTrigger>
                <SelectContent>
                  {opcoesCorretores.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      {carregandoCorretores ? "Carregando..." : "Nenhum corretor encontrado"}
                    </div>
                  ) : (
                    opcoesCorretores.map((o) => <SelectItem key={o.user_id} value={o.user_id}>{o.nome}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
              <div className="grid sm:grid-cols-4 gap-3">
                <div className="space-y-1"><Label className="text-xs">CPF</Label><Input value={corretor2.cpf} onChange={(e) => setCorretor2({ ...corretor2, cpf: maskCPF(e.target.value) })} inputMode="numeric" placeholder="000.000.000-00" /></div>
                <div className="space-y-1"><Label className="text-xs">RG</Label><Input value={corretor2.rg} onChange={(e) => setCorretor2({ ...corretor2, rg: maskRG(e.target.value) })} placeholder="0000000000" /></div>
                <div className="space-y-1"><Label className="text-xs">E-mail</Label><Input value={corretor2.email} onChange={(e) => setCorretor2({ ...corretor2, email: e.target.value })} placeholder="nome@uhome.imb.br" /></div>
                <div className="space-y-1"><Label className="text-xs">% Comissão</Label><Input type="number" min={0} max={100} value={corretor2.percentual} onChange={(e) => setCorretor2({ ...corretor2, percentual: e.target.value })} /></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comissão */}
      <Card>
        <CardHeader><CardTitle className="text-base">Comissão</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-4">
            <div className="space-y-2"><Label>Valor total da corretagem</Label><Input value={formatCurrencyInput(valorTotal)} onChange={(e) => setValorTotal(handleCurrencyChange(e.target.value))} inputMode="numeric" placeholder="R$ 00.000,00" /></div>
            <div className="space-y-2"><Label>% Gabrielle</Label><Input type="number" min={0} max={100} value={pctGabrielle} onChange={(e) => setPctGabrielle(e.target.value)} /></div>
            <div className="space-y-2"><Label>% Diretoria</Label><Input type="number" min={0} max={100} value={pctDiretoria} onChange={(e) => setPctDiretoria(e.target.value)} /></div>
            <div className="space-y-2"><Label>% UHome (auto)</Label><Input value={`${round2(pctUhome)}%`} readOnly disabled /></div>
          </div>
          {pctExcedido && (
            <p className="text-sm font-medium text-destructive">
              A soma dos percentuais (corretores + Gabrielle + Diretoria = {round2(somaPercentuais)}%) ultrapassa 100%.
            </p>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Parcelas</Label>
              <Button variant="outline" size="sm" onClick={addParcela}><Plus className="h-4 w-4 mr-1" /> Adicionar parcela</Button>
            </div>
            {parcelas.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <div className="space-y-1"><Label className="text-xs">Vencimento</Label><Input type="date" value={p.vencimento} onChange={(e) => updateParcela(i, "vencimento", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Valor</Label><Input value={formatCurrencyInput(p.valor)} onChange={(e) => updateParcela(i, "valor", handleCurrencyChange(e.target.value))} inputMode="numeric" placeholder="R$ 0.000,00" /></div>
                <Button variant="ghost" size="icon" onClick={() => removeParcela(i)} disabled={parcelas.length === 1}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {parcelasDivergem && (
              <p className="text-sm font-medium text-amber-600">
                A soma das parcelas ({brl(somaParcelas)}) difere do valor total da corretagem ({brl(num(valorTotal))}).
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Data do contrato</Label><Input type="date" value={dataContrato} onChange={(e) => setDataContrato(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Testemunhas */}
      <Card>
        <CardHeader><CardTitle className="text-base">Testemunhas</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {[
            { label: "Testemunha 1", value: testemunha1, setter: setTestemunha1 },
            { label: "Testemunha 2", value: testemunha2, setter: setTestemunha2 },
          ].map(({ label, value, setter }) => (
            <div key={label} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label className="font-medium">{label}</Label>
                <Select value="" onValueChange={(v) => preencherTestemunha(v, setter)} disabled={carregandoCorretores}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Preencher rapidamente..." /></SelectTrigger>
                  <SelectContent>
                    {opcoesTestemunha.map((o) => (
                      <SelectItem key={o.nome} value={o.nome}>{o.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={value.nome} onChange={(e) => setter({ ...value, nome: e.target.value })} placeholder="Ex: Carolina de Camargo Madruga" /></div>
                <div className="space-y-1"><Label className="text-xs">E-mail</Label><Input value={value.email} onChange={(e) => setter({ ...value, email: e.target.value })} placeholder="nome@uhome.com.br" /></div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader><CardTitle className="text-base">Pré-visualização do quadro de pagamentos</CardTitle></CardHeader>
        <CardContent className="space-y-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Credor</TableHead>
                <TableHead>Valor</TableHead>
                {parcelas.map((p, i) => <TableHead key={i}>{fmtDataCurta(p.vencimento)}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {calc.credores.map((c) => (
                <TableRow key={c.nome}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{brl(c.total)}</TableCell>
                  {c.parcelas.map((v, i) => <TableCell key={i}>{brl(v)}</TableCell>)}
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell>Total</TableCell>
                <TableCell>{brl(calc.credores.reduce((s, c) => s + c.total, 0))}</TableCell>
                {calc.totalLinha.map((v, i) => <TableCell key={i}>{brl(v)}</TableCell>)}
              </TableRow>
            </TableBody>
          </Table>

          <div>
            <p className="text-sm font-medium mb-2">2.1 — Divisão de pagamento (ZemoBank)</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Credor</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Valor total</TableHead>
                  {parcelas.map((p, i) => <TableHead key={i}>{fmtDataCurta(p.vencimento)}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">ZemoBank</TableCell>
                  <TableCell>Pix ou Boleto</TableCell>
                  <TableCell>{brl(calc.zemo.total)}</TableCell>
                  {calc.zemo.parcelas.map((v, i) => <TableCell key={i}>{brl(v)}</TableCell>)}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

          <div className="flex justify-end pb-10">
            <Button onClick={handleGerar} disabled={gerando} style={{ backgroundColor: ACCENT }} className="text-white hover:opacity-90">
              {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSignature className="h-4 w-4 mr-2" />}
              Gerar Intermediação
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="historico">
          <HistoricoTab onEditar={carregarIntermediacao} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Aba Histórico ──────────────────────────────────────────────────────────────
interface IntermediacaoRegistro {
  id: string;
  created_at: string;
  comprador_nome: string;
  tipo_pessoa: string;
  empreendimento: string;
  unidade: string;
  vgv: number;
  valor_comissao: number;
  corretores: string[];
  arquivo_path: string;
  filename: string;
  payload: any;
}

const fmtDataHist = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

function HistoricoTab({ onEditar }: { onEditar: (payload: any) => void }) {
  const [registros, setRegistros] = useState<IntermediacaoRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [baixando, setBaixando] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("intermediacoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Erro ao carregar o histórico.");
      } else {
        setRegistros((data ?? []) as IntermediacaoRegistro[]);
      }
      setLoading(false);
    })();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return registros;
    return registros.filter(
      (r) =>
        r.comprador_nome.toLowerCase().includes(q) ||
        r.empreendimento.toLowerCase().includes(q),
    );
  }, [registros, busca]);

  const baixar = async (r: IntermediacaoRegistro) => {
    setBaixando(r.id);
    try {
      const { data, error } = await supabase.storage
        .from("intermediacoes")
        .createSignedUrl(r.arquivo_path, 300);
      if (error || !data?.signedUrl) throw error ?? new Error("URL não gerada");
      window.open(data.signedUrl, "_blank");
    } catch {
      toast.error("Não foi possível gerar o link de download.");
    } finally {
      setBaixando(null);
    }
  };

  const apagar = async (r: IntermediacaoRegistro) => {
    setApagando(r.id);
    try {
      if (r.arquivo_path) {
        await supabase.storage.from("intermediacoes").remove([r.arquivo_path]);
      }
      const { error } = await supabase.from("intermediacoes").delete().eq("id", r.id);
      if (error) throw error;
      setRegistros((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Intermediação apagada.");
    } catch {
      toast.error("Não foi possível apagar a intermediação.");
    } finally {
      setApagando(null);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por comprador ou empreendimento..."
            className="pl-8"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma intermediação encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Empreendimento / Unidade</TableHead>
                  <TableHead className="text-right">VGV</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead>Corretores</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">{fmtDataHist(r.created_at)}</TableCell>
                    <TableCell className="text-sm font-medium">{r.comprador_nome}</TableCell>
                    <TableCell className="text-sm">
                      {r.empreendimento}
                      <span className="text-muted-foreground"> / {r.unidade}</span>
                    </TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">{brl(r.vgv)}</TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">{brl(r.valor_comissao)}</TableCell>
                    <TableCell className="text-sm">{(r.corretores ?? []).join(", ")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEditar(r.payload)}
                          disabled={!r.payload}
                          title={r.payload ? "Editar e gerar novamente" : "Registro antigo sem dados para edição"}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="ml-1">Editar</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => baixar(r)}
                          disabled={baixando === r.id}
                        >
                          {baixando === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          <span className="ml-1">Download</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={apagando === r.id}
                            >
                              {apagando === r.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Apagar intermediação?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação remove permanentemente o registro de{" "}
                                <strong>{r.comprador_nome}</strong> e o documento gerado. Não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => apagar(r)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Apagar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
