import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
// ─── Máscaras de documentos/contato ────────────────────────────────────────────
const onlyDigits = (v: string) => v.replace(/\D/g, "");
export const maskCPF = (v: string) =>
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
export const maskRG = (v: string) => v.replace(/[^\dxX.-]/g, "").slice(0, 14);

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface CorretorOption {
  user_id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  creci: string | null;
}

export interface CorretorForm {
  user_id: string;
  nome: string;
  cpf: string;
  rg: string;
  email: string;
  percentual: string; // %
}

export interface CompradorForm {
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

export interface Parcela {
  vencimento: string; // yyyy-mm-dd
  valor: string;      // numérico
}

export interface Testemunha {
  nome: string;
  email: string;
}

// Testemunha fixa disponível como atalho de preenchimento.
const CAROLINA: Testemunha = { nome: "Carolina de Camargo Madruga", email: "carolina@uhome.com.br" };

// ─── Helpers de cálculo (replicado na edge function) ───────────────────────────
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const num = (v: string) => {
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtDataCurta = (iso: string) => {
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

export function calcularCredores(
  valorTotal: number,
  corretores: { nome: string; pct: number }[],
  pctGabrielle: number,
  pctDiretoria: number,
  parcelas: number[],
  gerentes: {nome:string;pct:number}[] = [],
): { credores: CredorCalc[]; totalLinha: number[]; zemo: { total: number; parcelas: number[] } } {
  const pctUhome = Math.max(0, 100 - corretores.reduce((s, c) => s + c.pct, 0) - gerentes.reduce((s,g)=>s+g.pct,0) - pctGabrielle - pctDiretoria);

  const defs: { nome: string; pct: number; isUhome: boolean }[] = [
    ...corretores.map((c) => ({ nome: c.nome, pct: c.pct, isUhome: false })),
    ...gerentes.map(g=>({nome:g.nome,pct:g.pct,isUhome:false})),
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
export function CompradorFields({
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

