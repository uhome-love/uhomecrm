import { useState, useEffect } from "react";
import { Copy, ExternalLink, Link2, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const BASE = "https://uhome.com.br";

const PAGES = [
  { label: "Home", path: "" },
  { label: "Busca", path: "/busca" },
  { label: "Anunciar", path: "/anunciar" },
  { label: "Avaliação", path: "/avaliar-imovel" },
  { label: "Blog", path: "/blog" },
  { label: "FAQ", path: "/faq" },
];

export default function LinksSite() {
  const { user } = useAuth();
  const [slug, setSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [customPath, setCustomPath] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("slug_ref")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setSlug(data?.slug_ref ?? null);
        setLoading(false);
      });
  }, [user]);

  const buildLink = (path: string) => `${BASE}/c/${slug}${path}`;

  const copyLink = async (link: string, key: string) => {
    await navigator.clipboard.writeText(link);
    setCopied(key);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!slug) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Slug não configurado</h1>
        <p className="text-muted-foreground">
          Seu perfil ainda não possui um slug personalizado. Entre em contato com seu gestor para configurá-lo.
        </p>
      </div>
    );
  }

  const customLink = customPath.trim()
    ? buildLink(customPath.startsWith("/") ? customPath.trim() : `/${customPath.trim()}`)
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Link2 className="h-6 w-6 text-primary" />
          Links do Site
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compartilhe seus links personalizados para rastrear leads vindos de você.
        </p>
      </div>

      <div className="grid gap-3">
        {PAGES.map(({ label, path }) => {
          const link = buildLink(path);
          const key = `page-${path || "home"}`;
          return (
            <Card key={key} className="border border-border bg-card">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{link}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => copyLink(link, key)}
                  >
                    {copied === key ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    asChild
                  >
                    <a href={link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Custom URL builder */}
      <Card className="border border-border bg-card">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Link personalizado</p>
          <p className="text-xs text-muted-foreground">
            Cole um caminho do site (ex: /imovel/cobertura-bela-vista) para gerar seu link rastreável.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="/imovel/slug-do-imovel"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              className="flex-1"
            />
            {customLink && (
              <Button
                size="icon"
                variant="outline"
                className="shrink-0"
                onClick={() => copyLink(customLink, "custom")}
              >
                {copied === "custom" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          {customLink && (
            <div className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
              <p className="text-xs text-muted-foreground truncate flex-1 mr-2">{customLink}</p>
              <a href={customLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
