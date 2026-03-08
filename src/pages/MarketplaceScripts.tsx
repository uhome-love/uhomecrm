import { useState } from "react";
import { useMarketplace, CATEGORY_LABELS, CATEGORY_ICONS, type MarketplaceCategory, type MarketplaceSortBy } from "@/hooks/useMarketplace";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Copy, Star, Plus, Search, TrendingUp, Award, Clock, CheckCircle, XCircle, Loader2, BarChart3, Users, Sparkles, BookOpen, Rocket, Zap } from "lucide-react";
import { toast } from "sonner";

const homiMascot = "/images/homi-mascot-opt.png";

function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`h-4 w-4 ${n <= value ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"} ${!readonly ? "cursor-pointer hover:scale-110 transition-transform" : ""}`}
          onClick={() => !readonly && onChange?.(n)}
        />
      ))}
    </div>
  );
}

function ItemCard({ item, onUse, onRate }: { item: any; onUse: (id: string) => void; onRate: (id: string, nota: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const preview = item.conteudo?.slice(0, 200) + (item.conteudo?.length > 200 ? "..." : "");

  const handleCopy = () => {
    navigator.clipboard.writeText(item.conteudo);
    onUse(item.id);
    toast.success("Script copiado! 📋");
  };

  return (
    <Card className="border-border hover:border-primary/30 transition-all hover:shadow-md group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{CATEGORY_ICONS[item.categoria as MarketplaceCategory] || "📄"}</span>
              <h3 className="font-semibold text-sm text-foreground truncate">{item.titulo}</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">
                {CATEGORY_LABELS[item.categoria as MarketplaceCategory]?.replace(/^.\s/, "") || item.categoria}
              </Badge>
              {item.origem === "homi" && (
                <Badge className="text-[10px] gap-1 bg-gradient-to-r from-primary/20 to-primary/10 text-primary border-primary/30">
                  <img src={homiMascot} alt="" className="h-3 w-3" /> HOMI
                </Badge>
              )}
              {(item.tags || []).slice(0, 3).map((t: string) => (
                <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
              ))}
            </div>
          </div>
        </div>

        <div
          className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap cursor-pointer bg-muted/30 rounded-lg p-3 border border-border hover:border-primary/20 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? item.conteudo : preview}
          {item.conteudo?.length > 200 && (
            <span className="text-primary text-[10px] ml-1 font-medium">{expanded ? "ver menos ↑" : "ver mais →"}</span>
          )}
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="font-medium">{item.autor_nome}</span>
            </div>
            <div className="flex items-center gap-1">
              <StarRating value={Number(item.media_avaliacao || 0)} readonly />
              <span className="text-[10px] text-muted-foreground">({item.total_avaliacoes || 0})</span>
            </div>
            <span className="text-[10px] text-muted-foreground">📋 {item.total_usos || 0} usos</span>
          </div>
          <div className="flex gap-1.5">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => onRate(item.id, n)} className="hover:scale-125 transition-transform" title={`Avaliar ${n}⭐`}>
                  <Star className={`h-3 w-3 ${n <= Number(item.media_avaliacao || 0) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/20"}`} />
                </button>
              ))}
            </div>
            <Button size="sm" variant="default" onClick={handleCopy} className="gap-1 text-xs h-7">
              <Copy className="h-3 w-3" /> Usar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PendingCard({ item, onApprove, onReject }: { item: any; onApprove: (id: string) => void; onReject: (id: string) => void }) {
  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] border-warning text-warning">Pendente</Badge>
              <h3 className="font-semibold text-sm">{item.titulo}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Por: {item.autor_nome} • {CATEGORY_LABELS[item.categoria as MarketplaceCategory]?.replace(/^.\s/, "") || item.categoria}</p>
            <div className="text-xs bg-muted/30 rounded p-2 max-h-24 overflow-y-auto whitespace-pre-wrap">{item.conteudo}</div>
          </div>
          <div className="flex flex-col gap-1">
            <Button size="sm" variant="default" onClick={() => onApprove(item.id)} className="gap-1 text-xs h-7">
              <CheckCircle className="h-3 w-3" /> Aprovar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onReject(item.id)} className="gap-1 text-xs h-7">
              <XCircle className="h-3 w-3" /> Rejeitar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SubmitDialog({ onSubmit, submitting }: { onSubmit: (data: any) => void; submitting: boolean }) {
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [categoria, setCategoria] = useState<MarketplaceCategory>("script_ligacao");
  const [tagsStr, setTagsStr] = useState("");
  const [open, setOpen] = useState(false);

  const handleSubmit = () => {
    if (!titulo.trim() || !conteudo.trim()) { toast.error("Preencha título e conteúdo"); return; }
    onSubmit({
      titulo: titulo.trim(),
      conteudo: conteudo.trim(),
      categoria,
      tags: tagsStr.split(",").map(t => t.trim()).filter(Boolean),
    });
    setTitulo(""); setConteudo(""); setTagsStr("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" /> Publicar Material
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Publicar no Marketplace
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Título do material" value={titulo} onChange={e => setTitulo(e.target.value)} />
          <Select value={categoria} onValueChange={v => setCategoria(v as MarketplaceCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Cole o script ou argumento aqui..."
            value={conteudo}
            onChange={e => setConteudo(e.target.value)}
            className="min-h-[160px] font-mono text-xs"
          />
          <Input placeholder="Tags separadas por vírgula (ex: primeiro contato, reengajamento)" value={tagsStr} onChange={e => setTagsStr(e.target.value)} />
          <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Enviar para Aprovação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyExploreState({ hasFilter, search, onClearFilters, onOpenPublish }: { hasFilter: boolean; search: string; onClearFilters: () => void; onOpenPublish: () => void }) {
  if (hasFilter) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/20">
        <CardContent className="py-12 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm font-semibold text-foreground mb-1">
            Nenhum resultado para "{search}"
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Tenta outra categoria ou{" "}
            <button onClick={onClearFilters} className="text-primary hover:underline font-medium">
              limpar filtros
            </button>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="py-14 text-center">
        <div className="text-5xl mb-4">📚</div>
        <h3 className="text-lg font-bold text-foreground mb-2">
          Marketplace ainda vazio!
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
          Os melhores corretores compartilham o que funciona.
          <br />
          Publica o seu primeiro script e ajuda o time. 🚀
        </p>
        <Button onClick={onOpenPublish} size="lg" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="h-5 w-5" /> Publicar meu primeiro script
        </Button>
      </CardContent>
    </Card>
  );
}

function SeedBanner({ onSeed, seeding }: { onSeed: () => void; seeding: boolean }) {
  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 overflow-hidden relative">
      <CardContent className="p-4 flex items-center gap-4">
        <img src={homiMascot} alt="Homi" className="h-14 w-14 object-contain flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm text-foreground">HOMI preparou scripts para você!</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Carrega a base inicial com scripts profissionais de ligação, WhatsApp, quebra de objeções e mais. Tudo editável e avaliável pelo time.
          </p>
        </div>
        <Button onClick={onSeed} disabled={seeding} className="gap-1.5 flex-shrink-0">
          {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          {seeding ? "Carregando..." : "Carregar scripts"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function MarketplacePage() {
  const { isGestor, isAdmin } = useUserRole();
  const [category, setCategory] = useState<MarketplaceCategory | "">("");
  const [sortBy, setSortBy] = useState<MarketplaceSortBy>("mais_usados");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("explorar");
  const [publishOpen, setPublishOpen] = useState(false);

  const { items, pendingItems, myItems, isLoading, submitItem, approveItem, rejectItem, useItem, rateItem, stats, seedMarketplace, isSeeding } = useMarketplace(
    category ? category as MarketplaceCategory : undefined,
    sortBy,
    search || undefined
  );

  const hasActiveFilter = !!(search || category);
  const showSeedBanner = !isLoading && items.length === 0 && !hasActiveFilter && (isGestor || isAdmin);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <img src={homiMascot} alt="Homi" className="h-12 w-12 object-contain" />
          <div className="absolute -bottom-0.5 -right-0.5 bg-primary rounded-full p-0.5">
            <BookOpen className="h-3 w-3 text-primary-foreground" />
          </div>
        </div>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Marketplace <span className="text-primary">de Scripts</span>
          </h1>
          <p className="text-sm text-muted-foreground">Base de conhecimento coletiva — os melhores scripts e argumentos do time</p>
        </div>
        <SubmitDialog onSubmit={data => submitItem.mutate(data)} submitting={submitItem.isPending} />
      </div>

      {/* Quick stats bar */}
      {items.length > 0 && (
        <div className="flex gap-4 px-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">{stats.totalItems}</span> scripts
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Copy className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">{stats.totalUsos}</span> usos
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
            <span className="font-semibold text-foreground">{stats.avgRating}</span> média
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">{new Set(items.map((i: any) => i.autor_id)).size}</span> autores
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="explorar" className="gap-1.5 text-xs">
            <Search className="h-3.5 w-3.5" /> Explorar
          </TabsTrigger>
          <TabsTrigger value="meus" className="gap-1.5 text-xs">
            <Star className="h-3.5 w-3.5" /> Meus Materiais
          </TabsTrigger>
          {(isGestor || isAdmin) && (
            <TabsTrigger value="moderar" className="gap-1.5 text-xs">
              <CheckCircle className="h-3.5 w-3.5" /> Moderar
              {stats.pendingCount > 0 && <Badge variant="destructive" className="ml-1 text-[10px] h-4 min-w-4 px-1">{stats.pendingCount}</Badge>}
            </TabsTrigger>
          )}
          {(isGestor || isAdmin) && (
            <TabsTrigger value="dashboard" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" /> Dashboard
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="explorar" className="mt-4 space-y-4">
          {/* Seed banner for managers when empty */}
          {showSeedBanner && (
            <SeedBanner onSeed={() => seedMarketplace.mutate()} seeding={isSeeding} />
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar scripts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <Select value={category || "__all__"} onValueChange={v => setCategory(v === "__all__" ? "" : v as MarketplaceCategory)}>
              <SelectTrigger className="w-52 h-9"><SelectValue placeholder="Todas categorias" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas categorias</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={v => setSortBy(v as MarketplaceSortBy)}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mais_usados"><TrendingUp className="h-3 w-3 inline mr-1" /> Mais Usados</SelectItem>
                <SelectItem value="melhor_avaliados"><Award className="h-3 w-3 inline mr-1" /> Melhor Avaliados</SelectItem>
                <SelectItem value="recentes"><Clock className="h-3 w-3 inline mr-1" /> Mais Recentes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <Button
                key={k}
                size="sm"
                variant={category === k ? "default" : "outline"}
                onClick={() => setCategory(category === k ? "" : k as MarketplaceCategory)}
                className="text-xs h-7"
              >
                {v}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Carregando...
            </div>
          ) : items.length === 0 ? (
            <EmptyExploreState
              hasFilter={hasActiveFilter}
              search={search || category}
              onClearFilters={() => { setSearch(""); setCategory(""); }}
              onOpenPublish={() => setPublishOpen(true)}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {items.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onUse={id => useItem.mutate(id)}
                  onRate={(id, nota) => rateItem.mutate({ itemId: id, nota })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="meus" className="mt-4">
          {myItems.length === 0 ? (
            <Card className="border-dashed border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="py-14 text-center">
                <div className="text-5xl mb-4">✍️</div>
                <h3 className="text-lg font-bold text-foreground mb-2">Nenhum material publicado</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  Compartilha aquele script que funciona bem pra ti. O time agradece! 💪
                </p>
                <SubmitDialog onSubmit={data => submitItem.mutate(data)} submitting={submitItem.isPending} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {myItems.map(item => (
                <Card key={item.id} className="border-border hover:border-primary/20 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">{item.titulo}</h3>
                      <Badge variant={item.status === "aprovado" ? "default" : item.status === "pendente" ? "secondary" : "destructive"} className="text-[10px]">
                        {item.status === "aprovado" ? "✅ Aprovado" : item.status === "pendente" ? "⏳ Pendente" : "❌ Rejeitado"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">{item.conteudo}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span>📋 {item.total_usos || 0} usos</span>
                      <span>⭐ {item.media_avaliacao || 0}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {(isGestor || isAdmin) && (
          <TabsContent value="moderar" className="mt-4 space-y-3">
            {pendingItems.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <CheckCircle className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum material pendente de aprovação. 🎉</p>
                </CardContent>
              </Card>
            ) : (
              pendingItems.map(item => (
                <PendingCard
                  key={item.id}
                  item={item}
                  onApprove={id => approveItem.mutate(id)}
                  onReject={id => rejectItem.mutate(id)}
                />
              ))
            )}
          </TabsContent>
        )}

        {(isGestor || isAdmin) && (
          <TabsContent value="dashboard" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Materiais Aprovados</p>
                  <p className="text-2xl font-display font-bold text-primary">{stats.totalItems}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Total de Usos</p>
                  <p className="text-2xl font-display font-bold text-primary">{stats.totalUsos}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Avaliação Média</p>
                  <p className="text-2xl font-display font-bold text-primary">⭐ {stats.avgRating}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Pendentes</p>
                  <p className="text-2xl font-display font-bold text-warning">{stats.pendingCount}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Mais Usados
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stats.topUsed.map((item: any, i: number) => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-primary">{i + 1}.</span>
                        <span className="truncate max-w-[200px]">{item.titulo}</span>
                      </span>
                      <Badge variant="secondary" className="text-[10px]">{item.total_usos} usos</Badge>
                    </div>
                  ))}
                  {stats.topUsed.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" /> Melhor Avaliados
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stats.topRated.map((item: any, i: number) => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-primary">{i + 1}.</span>
                        <span className="truncate max-w-[200px]">{item.titulo}</span>
                      </span>
                      <span className="text-yellow-500">⭐ {item.media_avaliacao}</span>
                    </div>
                  ))}
                  {stats.topRated.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}