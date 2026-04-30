/**
 * Ficha técnica completa do imóvel (visão corretor).
 * Renderiza TODOS os dados internos do Jetimob — origem (RGI/Órulo), status,
 * exclusividade, observações, comodidades, condomínio, plantas, datas etc.
 *
 * Seção "Proprietário" só renderiza para gestor/admin (CEO).
 * Dados de contato do proprietário são puxados sob demanda via jetimob-proxy.
 */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Lock, ChevronDown, ChevronUp, Loader2, User, Phone, Mail,
  FileText, Building, Calendar, MapPin, Star, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  imovel: any | null; // payload completo do Jetimob (resposta de get_imovel)
  loading?: boolean;
}

const ownerCache = new Map<string, any>();

export default function BrokerTechnicalSheet({ imovel, loading }: Props) {
  const { isGestor } = useUserRole();
  const [open, setOpen] = useState(false);
  const [ownersOpen, setOwnersOpen] = useState(false);
  const [ownerData, setOwnerData] = useState<Record<string, any>>({});
  const [ownerLoading, setOwnerLoading] = useState<Record<string, boolean>>({});
  const [ownerError, setOwnerError] = useState<Record<string, string>>({});

  if (!imovel && !loading) return null;

  const fetchProprietario = async (id: string) => {
    if (ownerCache.has(id)) {
      setOwnerData((p) => ({ ...p, [id]: ownerCache.get(id) }));
      return;
    }
    setOwnerLoading((p) => ({ ...p, [id]: true }));
    setOwnerError((p) => ({ ...p, [id]: "" }));
    try {
      const { data, error } = await supabase.functions.invoke("jetimob-proxy", {
        body: { action: "get_proprietario", id_proprietario: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const p = data?.proprietario || data;
      ownerCache.set(id, p);
      setOwnerData((prev) => ({ ...prev, [id]: p }));
    } catch (e: any) {
      setOwnerError((prev) => ({ ...prev, [id]: e?.message || "Falha ao buscar" }));
    } finally {
      setOwnerLoading((p) => ({ ...p, [id]: false }));
    }
  };

  const fmtDate = (s?: string) => {
    if (!s) return "—";
    try {
      const d = new Date(s);
      if (isNaN(d.getTime())) return s;
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return s; }
  };

  // Campos do payload Jetimob
  const i = imovel || {};
  const origem = i.origem || "—";
  const status = i.status || i.situacao || "—";
  const exclusividade = i.exclusividade;
  const obs = i.observacoes;
  const idImovel = i.id_imovel;
  const idCorretor = i.id_corretor;
  const dataCadastro = i.data_cadastro;
  const dataAtualizacao = i.data_atualizacao || i.data_update || i.updated_at;
  const condominio = {
    nome: i.condominio_nome,
    tipo: i.condominio_tipo,
    fechado: i.condominio_fechado,
    comodidades: Array.isArray(i.condominio_comodidades) ? i.condominio_comodidades : [],
  };
  const comodidadesImovel = Array.isArray(i.imovel_comodidades) ? i.imovel_comodidades : [];
  const plantas = Array.isArray(i.plantas) ? i.plantas : [];
  const proprietarios = Array.isArray(i.proprietarios) ? i.proprietarios : [];
  const enderecoCompleto = [
    i.endereco_logradouro,
    i.endereco_numero,
    i.endereco_complemento,
    i.endereco_bairro,
    i.endereco_cidade,
    i.endereco_estado,
    i.endereco_cep,
  ].filter(Boolean).join(", ");
  const referencia = i.endereco_referencia;
  const zona = i.endereco_zona;
  const tipoConstrucao = i.tipo_construcao;
  const tipoPiso = i.tipo_piso;
  const tipologia = i.tipologia;
  const posicao = i.posicao;
  const distanciaMar = i.distancia_mar;
  const terreno = {
    total: i.terreno_total || i.medida_terreno_total,
    frente: i.terreno_frente,
    fundos: i.terreno_fundos,
    direita: i.terreno_direita,
    esquerdo: i.terreno_esquerdo,
  };
  const valoresExtras = {
    seguro_incendio: i.valor_seguro_incendio,
    seguro_fianca: i.seguro_fianca,
    taxa_limpeza: i.valor_taxa_limpeza,
    temporada: i.valor_temporada,
    periodicidade_iptu: i.periodicidade_iptu,
  };
  const permuta = i.permuta;
  const mobiliado = i.mobiliado;
  const financiavel = i.financiavel;
  const destaque = i.destaque;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/10 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100/40 dark:hover:bg-amber-950/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-amber-500/15 flex items-center justify-center">
            <Lock className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
              Ficha técnica do corretor
            </p>
            <p className="text-[10px] text-amber-700/70 dark:text-amber-400/70">
              Dados internos do Jetimob — uso interno
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-amber-700 dark:text-amber-400" /> : <ChevronDown className="h-4 w-4 text-amber-700 dark:text-amber-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-amber-500/20">
          {loading && !imovel && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando dados internos do Jetimob...
            </div>
          )}

          {imovel && (
            <>
              {/* Identificação interna */}
              <Section title="Identificação" icon={FileText}>
                <Row label="Origem (sistema)" value={<Badge variant="outline" className="font-bold uppercase">{origem}</Badge>} />
                <Row label="Status Jetimob" value={status} />
                {exclusividade && <Row label="Exclusividade" value={<Badge className="bg-emerald-600 text-white">EXCLUSIVO</Badge>} />}
                {idImovel && <Row label="ID Jetimob" value={<code className="text-[11px]">{idImovel}</code>} />}
                {idCorretor && <Row label="ID Corretor responsável" value={<code className="text-[11px]">{idCorretor}</code>} />}
                {destaque && <Row label="Destaque" value={<Badge variant="secondary">Sim</Badge>} />}
              </Section>

              {/* Endereço completo */}
              {(enderecoCompleto || referencia || zona) && (
                <Section title="Endereço completo" icon={MapPin}>
                  {enderecoCompleto && <Row label="Endereço" value={enderecoCompleto} />}
                  {referencia && <Row label="Referência" value={referencia} />}
                  {zona && <Row label="Zona" value={zona} />}
                </Section>
              )}

              {/* Características técnicas */}
              {(tipoConstrucao || tipoPiso || tipologia || posicao || distanciaMar) && (
                <Section title="Características técnicas" icon={Building}>
                  {tipoConstrucao && <Row label="Tipo construção" value={tipoConstrucao} />}
                  {tipoPiso && <Row label="Tipo de piso" value={tipoPiso} />}
                  {tipologia && <Row label="Tipologia" value={tipologia} />}
                  {posicao && <Row label="Posição" value={posicao} />}
                  {distanciaMar && <Row label="Distância do mar" value={`${distanciaMar} m`} />}
                  {mobiliado && <Row label="Mobiliado" value={String(mobiliado)} />}
                  {financiavel && <Row label="Financiável" value={String(financiavel)} />}
                  {permuta && <Row label="Aceita permuta" value={String(permuta)} />}
                </Section>
              )}

              {/* Terreno */}
              {(terreno.total || terreno.frente) && (
                <Section title="Medidas do terreno" icon={Building}>
                  {terreno.total && <Row label="Área total" value={`${terreno.total} m²`} />}
                  {terreno.frente && <Row label="Frente" value={`${terreno.frente} m`} />}
                  {terreno.fundos && <Row label="Fundos" value={`${terreno.fundos} m`} />}
                  {terreno.direita && <Row label="Lateral direita" value={`${terreno.direita} m`} />}
                  {terreno.esquerdo && <Row label="Lateral esquerda" value={`${terreno.esquerdo} m`} />}
                </Section>
              )}

              {/* Condomínio */}
              {(condominio.nome || condominio.comodidades.length > 0) && (
                <Section title="Condomínio" icon={Building}>
                  {condominio.nome && <Row label="Nome" value={condominio.nome} />}
                  {condominio.tipo && <Row label="Tipo" value={condominio.tipo} />}
                  {condominio.fechado && <Row label="Fechado" value="Sim" />}
                  {condominio.comodidades.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] text-muted-foreground mb-1">Comodidades do condomínio</p>
                      <div className="flex flex-wrap gap-1">
                        {condominio.comodidades.map((c: any, idx: number) => (
                          <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border/50">
                            {typeof c === "string" ? c : c?.nome || c?.descricao || JSON.stringify(c)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>
              )}

              {/* Comodidades do imóvel */}
              {comodidadesImovel.length > 0 && (
                <Section title="Comodidades internas do imóvel" icon={Star}>
                  <div className="flex flex-wrap gap-1">
                    {comodidadesImovel.map((c: any, idx: number) => (
                      <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border/50">
                        {typeof c === "string" ? c : c?.nome || c?.descricao || JSON.stringify(c)}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Valores extras */}
              {(valoresExtras.seguro_incendio || valoresExtras.taxa_limpeza || valoresExtras.temporada || valoresExtras.periodicidade_iptu) && (
                <Section title="Valores adicionais" icon={FileText}>
                  {valoresExtras.seguro_incendio && <Row label="Seguro incêndio" value={`R$ ${valoresExtras.seguro_incendio}`} />}
                  {valoresExtras.seguro_fianca && <Row label="Seguro fiança" value={String(valoresExtras.seguro_fianca)} />}
                  {valoresExtras.taxa_limpeza && <Row label="Taxa de limpeza" value={`R$ ${valoresExtras.taxa_limpeza}`} />}
                  {valoresExtras.temporada && <Row label="Diária temporada" value={`R$ ${valoresExtras.temporada}`} />}
                  {valoresExtras.periodicidade_iptu && <Row label="Periodicidade IPTU" value={valoresExtras.periodicidade_iptu} />}
                </Section>
              )}

              {/* Plantas */}
              {plantas.length > 0 && (
                <Section title={`Plantas (${plantas.length})`} icon={FileText}>
                  <div className="grid grid-cols-2 gap-2">
                    {plantas.slice(0, 6).map((p: any, idx: number) => {
                      const url = p?.link || p?.url || (typeof p === "string" ? p : null);
                      if (!url) return null;
                      return (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block rounded border border-border/50 overflow-hidden hover:border-primary">
                          <img src={url} alt={`Planta ${idx + 1}`} className="w-full h-20 object-cover" loading="lazy" />
                        </a>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Datas */}
              {(dataCadastro || dataAtualizacao) && (
                <Section title="Histórico" icon={Calendar}>
                  {dataCadastro && <Row label="Cadastrado em" value={fmtDate(dataCadastro)} />}
                  {dataAtualizacao && <Row label="Última atualização" value={fmtDate(dataAtualizacao)} />}
                </Section>
              )}

              {/* Observações internas */}
              {obs && (
                <Section title="Observações internas" icon={AlertCircle}>
                  <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{obs}</p>
                </Section>
              )}

              {/* Proprietário — somente gestor/admin */}
              {isGestor && proprietarios.length > 0 && (
                <div className="rounded-lg border-2 border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/10 overflow-hidden">
                  <button
                    onClick={() => setOwnersOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-rose-100/40 dark:hover:bg-rose-950/20"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-rose-700 dark:text-rose-400" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-rose-900 dark:text-rose-300">
                        Proprietário ({proprietarios.length}) — Restrito
                      </span>
                    </div>
                    {ownersOpen ? <ChevronUp className="h-3.5 w-3.5 text-rose-700 dark:text-rose-400" /> : <ChevronDown className="h-3.5 w-3.5 text-rose-700 dark:text-rose-400" />}
                  </button>
                  {ownersOpen && (
                    <div className="px-3 pb-3 space-y-2 border-t border-rose-500/20">
                      {proprietarios.map((p: any) => {
                        const id = String(p?.id_proprietario || p?.id || "");
                        if (!id) return null;
                        const detail = ownerData[id];
                        const err = ownerError[id];
                        const isLoadingOwner = ownerLoading[id];
                        return (
                          <div key={id} className="rounded-md bg-white dark:bg-background border border-border/50 p-3 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-rose-600" />
                                <span className="text-xs font-semibold">ID {id}</span>
                                {p?.percentual_proriedade != null && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {Math.round(Number(p.percentual_proriedade) * 100)}%
                                  </Badge>
                                )}
                              </div>
                              {!detail && !isLoadingOwner && (
                                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => fetchProprietario(id)}>
                                  Buscar dados
                                </Button>
                              )}
                            </div>
                            {isLoadingOwner && (
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" /> Buscando no Jetimob...
                              </div>
                            )}
                            {err && (
                              <p className="text-[11px] text-destructive">{err}</p>
                            )}
                            {detail && (
                              <div className="text-[11px] space-y-1 mt-1">
                                {detail.nome && <p><span className="text-muted-foreground">Nome:</span> <span className="font-semibold">{detail.nome}</span></p>}
                                {detail.cpf_cnpj && <p><span className="text-muted-foreground">CPF/CNPJ:</span> <span className="font-mono">{detail.cpf_cnpj}</span></p>}
                                {detail.email && (
                                  <p className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    <a href={`mailto:${detail.email}`} className="text-primary hover:underline">{detail.email}</a>
                                  </p>
                                )}
                                {(detail.telefone || detail.celular || detail.telefone_celular) && (
                                  <p className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {(detail.telefone || detail.celular || detail.telefone_celular)}
                                  </p>
                                )}
                                {detail.endereco && (
                                  <p><span className="text-muted-foreground">Endereço:</span> {detail.endereco}</p>
                                )}
                                {detail.observacoes && (
                                  <p className="mt-1 pt-1 border-t border-border/50"><span className="text-muted-foreground">Obs:</span> {detail.observacoes}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Indicador para corretor: tem proprietário cadastrado mas é restrito */}
              {!isGestor && proprietarios.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-muted/30 p-2.5 flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    Há {proprietarios.length} proprietário(s) cadastrado(s). Dados disponíveis apenas para gestores.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white/60 dark:bg-background/40 border border-amber-500/15 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3 w-3 text-amber-700 dark:text-amber-400" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">{title}</p>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className={cn("font-medium text-foreground text-right", typeof value === "string" && "break-words")}>{value}</span>
    </div>
  );
}
