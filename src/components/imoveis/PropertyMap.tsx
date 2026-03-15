import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BedDouble, Car, Maximize, MapPin, Heart, Copy, Phone, X, Home, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getPropertyCardImages, extractEndereco, getNum } from "@/lib/imovelHelpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Types ──

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface PropertyMapProps {
  properties: any[];
  loading?: boolean;
  onBoundsChange?: (bounds: MapBounds) => void;
  onFavorite?: (id: string) => void;
  favorites?: Set<string>;
  getPreco: (item: any) => string;
  className?: string;
}

// ── Helpers ──

function getCoords(item: any): [number, number] | null {
  const lat = Number(item.latitude || item.lat || item.endereco_latitude);
  const lng = Number(item.longitude || item.lng || item.lon || item.endereco_longitude);
  if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;
  if (lat < -35 || lat > 5 || lng < -75 || lng > -30) return null;
  return [lat, lng];
}


const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtCompactPrice = (v: number): string => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}mil`;
  return String(v);
};

// ── Price Pin Icon ──

function createPriceIcon(price: string, isActive = false): L.DivIcon {
  return L.divIcon({
    className: "property-price-pin",
    html: `<div class="pin-label ${isActive ? "pin-active" : ""}">${price}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

// ── Cluster Icon ──

function createClusterIcon(cluster: any): L.DivIcon {
  const count = cluster.getChildCount();
  const size = count < 10 ? "small" : count < 50 ? "medium" : "large";
  return L.divIcon({
    html: `<div class="cluster-icon cluster-${size}"><span>${count}</span></div>`,
    className: "property-cluster",
    iconSize: L.point(40, 40),
  });
}

// ── Map event handler ──

function MapEventsHandler({ onBoundsChange }: { onBoundsChange?: (bounds: MapBounds) => void }) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useMapEvents({
    moveend: (e) => {
      if (!onBoundsChange) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const map = e.target;
        const b = map.getBounds();
        onBoundsChange({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        });
      }, 500);
    },
  });

  return null;
}

// ── Fit bounds to markers ──

function FitBoundsOnLoad({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || coords.length === 0) return;
    fitted.current = true;
    const bounds = L.latLngBounds(coords.map(([lat, lng]) => [lat, lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [coords, map]);

  return null;
}

// ── Mini Card (popup) ──

function MiniCard({ item, getPreco, onFavorite, isFavorite }: { item: any; getPreco: (i: any) => string; onFavorite?: (id: string) => void; isFavorite?: boolean }) {
  const images = getPropertyCardImages(item);
  const [imgIdx, setImgIdx] = useState(0);
  const loc = extractEndereco(item);
  const codigo = item.codigo;
  const titulo = item.titulo_anuncio || item.empreendimento_nome || "";
  const dorms = getNum(item, "dormitorios");
  const area = getNum(item, "area_privativa", "area_util", "area_total");
  const vagas = getNum(item, "garagens", "vagas");
  const imovelId = String(codigo || item.id_imovel || item.id);

  return (
    <div className="w-[260px] font-sans">
      {/* Image */}
      <div className="relative h-[140px] bg-muted rounded-t-lg overflow-hidden group">
        {images.length > 0 ? (
          <img src={images[imgIdx]} alt={titulo} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Home className="h-8 w-8 text-muted-foreground/30" /></div>
        )}
        {images.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); setImgIdx((p) => (p - 1 + images.length) % images.length); }}
              className="absolute left-1 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setImgIdx((p) => (p + 1) % images.length); }}
              className="absolute right-1 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="h-3 w-3" />
            </button>
          </>
        )}
        {onFavorite && (
          <button onClick={() => onFavorite(imovelId)}
            className="absolute top-2 right-2 bg-background/70 backdrop-blur-sm rounded-full p-1">
            <Heart className={cn("h-3.5 w-3.5", isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-1">
        <p className="text-sm font-bold text-foreground">{getPreco(item)}</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {dorms != null && dorms > 0 && <span><strong className="text-foreground">{dorms}</strong> dorm</span>}
          {area != null && area > 0 && <span><strong className="text-foreground">{area}</strong> m²</span>}
          {vagas != null && vagas > 0 && <span><strong className="text-foreground">{vagas}</strong> vaga{vagas > 1 ? "s" : ""}</span>}
        </div>
        {titulo && <p className="text-[11px] text-foreground/80 font-medium truncate">{titulo}</p>}
        {loc.bairro && <p className="text-[10px] text-muted-foreground truncate">{[loc.bairro, loc.cidade].filter(Boolean).join(", ")}</p>}
        <div className="flex items-center justify-between pt-1.5 border-t border-border/40">
          {codigo && <span className="text-[9px] text-muted-foreground/60 font-mono">{codigo}</span>}
          <div className="flex items-center gap-0.5">
            <button onClick={() => { const text = `${titulo} · ${loc.bairro} · ${getPreco(item)} · Cód. ${codigo}`; navigator.clipboard.writeText(text); toast.success("Dados copiados!"); }}
              className="p-1 rounded hover:bg-muted transition-colors"><Copy className="h-3 w-3 text-muted-foreground" /></button>
            <a href={`https://wa.me/?text=${encodeURIComponent(`${titulo} - ${loc.bairro} - ${getPreco(item)} (Cód. ${codigo})`)}`}
              target="_blank" rel="noopener noreferrer">
              <button className="p-1 rounded hover:bg-muted transition-colors"><Phone className="h-3 w-3 text-muted-foreground hover:text-green-600" /></button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// ██  PROPERTY MAP
// ══════════════════════════════════════

export default function PropertyMap({
  properties,
  loading,
  onBoundsChange,
  onFavorite,
  favorites = new Set(),
  getPreco,
  className,
}: PropertyMapProps) {
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  // Extract properties that have coordinates
  const mappableProperties = useMemo(() => {
    return properties
      .map((item) => {
        const coords = getCoords(item);
        if (!coords) return null;
        const price = getNum(item, "valor_venda", "preco_venda", "valor", "price");
        return { item, coords, priceLabel: price ? `R$${fmtCompactPrice(price)}` : "?" };
      })
      .filter(Boolean) as { item: any; coords: [number, number]; priceLabel: string }[];
  }, [properties]);

  const allCoords = useMemo(() => mappableProperties.map((p) => p.coords), [mappableProperties]);

  // Default center: Porto Alegre
  const defaultCenter: [number, number] = [-30.0346, -51.2177];

  if (mappableProperties.length === 0 && !loading) {
    return (
      <div className={cn("flex items-center justify-center bg-muted/30 rounded-lg border border-border/50", className)}>
        <div className="text-center p-8">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-sm font-medium text-foreground">Nenhum imóvel com localização</p>
          <p className="text-xs text-muted-foreground mt-1">Os imóveis atuais não possuem coordenadas disponíveis</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-lg overflow-hidden border border-border/50", className)}>
      {/* Custom CSS for pins */}
      <style>{`
        .property-price-pin { z-index: 1; }
        .pin-label {
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          border: 1.5px solid hsl(var(--border));
          border-radius: 8px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 700;
          font-family: system-ui, sans-serif;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
          transform: translate(-50%, -100%);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .pin-label:hover, .pin-active {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-color: hsl(var(--primary));
          transform: translate(-50%, -100%) scale(1.1);
          z-index: 10 !important;
        }
        .property-cluster { background: none !important; border: none !important; }
        .cluster-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-family: system-ui, sans-serif;
          font-weight: 700;
          font-size: 13px;
          color: hsl(var(--primary-foreground));
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        .cluster-small {
          width: 36px; height: 36px;
          background: hsl(var(--primary));
        }
        .cluster-medium {
          width: 44px; height: 44px;
          background: hsl(217 91% 50%);
        }
        .cluster-large {
          width: 52px; height: 52px;
          background: hsl(222 73% 17%);
        }
        .leaflet-popup-content-wrapper {
          padding: 0 !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 30px rgba(0,0,0,0.15) !important;
          overflow: hidden;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          width: auto !important;
        }
        .leaflet-popup-tip-container { display: none; }
        .leaflet-popup-close-button {
          top: 8px !important;
          right: 8px !important;
          color: white !important;
          font-size: 18px !important;
          z-index: 10;
          background: rgba(0,0,0,0.3);
          border-radius: 50%;
          width: 22px !important;
          height: 22px !important;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 !important;
        }
      `}</style>

      <MapContainer
        center={defaultCenter}
        zoom={13}
        className="h-full w-full"
        style={{ minHeight: "100%" }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />

        <MapEventsHandler onBoundsChange={onBoundsChange} />
        {allCoords.length > 0 && <FitBoundsOnLoad coords={allCoords} />}

        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
          iconCreateFunction={createClusterIcon}
        >
          {mappableProperties.map(({ item, coords, priceLabel }) => {
            const id = String(item.codigo || item.id_imovel || item.id);
            return (
              <Marker
                key={id}
                position={coords}
                icon={createPriceIcon(priceLabel, activeMarker === id)}
                eventHandlers={{
                  click: () => setActiveMarker(id),
                  popupclose: () => setActiveMarker(null),
                }}
              >
                <Popup>
                  <MiniCard
                    item={item}
                    getPreco={getPreco}
                    onFavorite={onFavorite}
                    isFavorite={favorites.has(id)}
                  />
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-[1000]">
          <div className="flex items-center gap-2 bg-background px-4 py-2 rounded-full shadow-lg border border-border">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium text-foreground">Buscando imóveis...</span>
          </div>
        </div>
      )}

      {/* Property count badge */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-background/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md border border-border/60">
        <span className="text-xs font-medium text-foreground">
          {mappableProperties.length} imóveis no mapa
        </span>
      </div>
    </div>
  );
}
