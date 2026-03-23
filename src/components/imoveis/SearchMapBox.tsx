/**
 * SearchMapBox — Mapbox GL map for /imoveis page.
 * Mirrors the SearchMap from uhome.com.br: streets-v12 style,
 * clustered price-pill pins, React popup preview, draw mode,
 * auto-search toggle, perto de você.
 */

import { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { type MapPin, formatPrecoCompact, formatPreco } from "@/services/siteImoveis";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, Search, Bed, Maximize, ToggleLeft, ToggleRight, PenTool, X, Check } from "lucide-react";
import { toast } from "sonner";

const MAPBOX_TOKEN = "pk.eyJ1IjoibHVjYXN1aG9tZSIsImEiOiJjbW16c2l2dmUwYmxsMnJwdDI2bGxrazBkIn0.B4dp727gJlQQIWTci7GpFQ";
mapboxgl.accessToken = MAPBOX_TOKEN;

function toGeoJSON(pins: MapPin[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: pins
      .filter(i => {
        const lat = Number(i.latitude), lng = Number(i.longitude);
        return lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng) && lat > -34 && lat < -27 && lng > -55 && lng < -48;
      })
      .map(i => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [Number(i.longitude), Number(i.latitude)] },
        properties: {
          id: i.id, slug: i.slug, preco: Number(i.preco),
          preco_label: formatPrecoCompact(Number(i.preco)),
          titulo: i.titulo ?? "", bairro: i.bairro ?? "", tipo: i.tipo ?? "",
          quartos: i.quartos ?? 0, area: i.area_total ?? 0,
          foto: i.foto_principal ?? "",
        },
      })),
  };
}

function createPillImage(fillColor: string, strokeColor: string, w = 80, h = 30): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const r = h / 2;
  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.15)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r); ctx.quadraticCurveTo(w, h, w - r, h); ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r); ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = fillColor; ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = strokeColor; ctx.lineWidth = 1;
  ctx.stroke();
  return ctx.getImageData(0, 0, w, h);
}

interface Props {
  pins?: MapPin[];
  hoveredId?: string | null;
  onPinHover?: (id: string | null) => void;
  onBoundsSearch?: (bounds: { lat_min: number; lat_max: number; lng_min: number; lng_max: number }) => void;
  onBoundsChange?: (bounds: { lat_min: number; lat_max: number; lng_min: number; lng_max: number }) => void;
  onPinClick?: (pin: MapPin) => void;
}

export function SearchMapBox({ pins = [], hoveredId, onPinHover, onBoundsSearch, onBoundsChange, onPinClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const initRef = useRef(false);
  const mapReadyRef = useRef(false);
  const pinsRef = useRef(pins);
  const boundsRef = useRef<mapboxgl.LngLatBounds | null>(null);
  const lastCenterRef = useRef<{ lat: number; lng: number }>({ lat: -30.0346, lng: -51.2177 });
  const initialBoundsReportedRef = useRef(false);

  const [mapMoved, setMapMoved] = useState(false);
  const [autoSearch, setAutoSearch] = useState(false);
  const autoSearchRef = useRef(false);
  const autoSearchTimerRef = useRef<number | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Preview popup state (React-rendered, like site)
  const [previewPin, setPreviewPin] = useState<MapPin | null>(null);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);

  // Draw mode
  const [drawMode, setDrawMode] = useState(false);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [hasDrawn, setHasDrawn] = useState(false);
  const drawPointsRef = useRef<[number, number][]>([]);

  const onBoundsSearchRef = useRef(onBoundsSearch);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onPinHoverRef = useRef(onPinHover);
  const onPinClickRef = useRef(onPinClick);

  useEffect(() => { pinsRef.current = pins; }, [pins]);
  useEffect(() => { onBoundsSearchRef.current = onBoundsSearch; }, [onBoundsSearch]);
  useEffect(() => { onBoundsChangeRef.current = onBoundsChange; }, [onBoundsChange]);
  useEffect(() => { onPinHoverRef.current = onPinHover; }, [onPinHover]);
  useEffect(() => { onPinClickRef.current = onPinClick; }, [onPinClick]);
  useEffect(() => { drawPointsRef.current = drawPoints; }, [drawPoints]);
  useEffect(() => { autoSearchRef.current = autoSearch; }, [autoSearch]);

  // Cleanup user marker
  useEffect(() => { return () => { userMarkerRef.current?.remove(); }; }, []);

  // Update pin data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    const source = map.getSource("imoveis") as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      const geojson = toGeoJSON(pins);
      if ("requestIdleCallback" in window) {
        const id = requestIdleCallback(() => source.setData(geojson), { timeout: 500 });
        return () => cancelIdleCallback(id);
      } else {
        requestAnimationFrame(() => source.setData(geojson));
      }
    }
  }, [pins]);

  // Hover highlight
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    map.setFilter("imoveis-pins-hover", hoveredId ? ["==", ["get", "id"], hoveredId] : ["==", ["get", "id"], ""]);
  }, [hoveredId]);

  // Init map
  useEffect(() => {
    if (initRef.current || !containerRef.current) return;
    initRef.current = true;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-51.1800, -30.0346],
      zoom: 12,
      dragRotate: false,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("imoveis", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true, clusterMaxZoom: 13, clusterRadius: 52,
        buffer: 64, tolerance: 0.4,
      });

      // Draw sources
      map.addSource("draw-polygon", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("draw-points", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      // Cluster circles — #5B6CF9 like site
      map.addLayer({
        id: "clusters", type: "circle", source: "imoveis",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#5B6CF9",
          "circle-radius": ["step", ["get", "point_count"], 20, 10, 26, 50, 32, 200, 38],
          "circle-stroke-width": 2, "circle-stroke-color": "#FFFFFF", "circle-opacity": 0.92,
        },
      });

      map.addLayer({
        id: "cluster-count", type: "symbol", source: "imoveis",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-size": 13, "text-allow-overlap": true,
        },
        paint: { "text-color": "#FFFFFF" },
      });

      map.addImage("pin-bg", createPillImage("#FFFFFF", "rgba(0,0,0,0.2)"));
      map.addImage("pin-bg-dark", createPillImage("#222222", "#222222"));

      map.addLayer({
        id: "imoveis-pins", type: "symbol", source: "imoveis",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": "pin-bg", "icon-text-fit": "both",
          "icon-text-fit-padding": [5, 10, 5, 10],
          "icon-allow-overlap": false, "icon-ignore-placement": false, "icon-padding": 4,
          "text-field": ["get", "preco_label"],
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-size": 12, "text-allow-overlap": false, "text-optional": true,
          "text-anchor": "center", "symbol-sort-key": ["get", "preco"],
        },
        paint: { "text-color": "#222222", "icon-opacity": 1 },
      });

      map.addLayer({
        id: "imoveis-pins-hover", type: "symbol", source: "imoveis",
        filter: ["==", ["get", "id"], ""],
        layout: {
          "icon-image": "pin-bg-dark", "icon-text-fit": "both",
          "icon-text-fit-padding": [5, 10, 5, 10],
          "icon-allow-overlap": true,
          "text-field": ["get", "preco_label"],
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-size": 12, "text-allow-overlap": true, "text-anchor": "center",
        },
        paint: { "text-color": "#FFFFFF" },
      });

      // Draw layers
      map.addLayer({ id: "draw-polygon-fill", type: "fill", source: "draw-polygon", paint: { "fill-color": "#5B6CF9", "fill-opacity": 0.12 } });
      map.addLayer({ id: "draw-polygon-line", type: "line", source: "draw-polygon", paint: { "line-color": "#5B6CF9", "line-width": 2.5, "line-dasharray": [2, 2] } });
      map.addLayer({ id: "draw-points-layer", type: "circle", source: "draw-points", paint: { "circle-color": "#FFFFFF", "circle-radius": 5, "circle-stroke-width": 2.5, "circle-stroke-color": "#5B6CF9" } });

      // Events
      map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0].properties!.cluster_id;
        (map.getSource("imoveis") as mapboxgl.GeoJSONSource).getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          map.easeTo({ center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom! });
        });
      });

      // Pin click → React preview popup
      map.on("click", "imoveis-pins", (e) => {
        const props = e.features?.[0]?.properties;
        if (!props) return;
        const pinData = pinsRef.current.find(p => p.id === props.id);
        if (pinData) {
          const point = map.project((e.features![0].geometry as GeoJSON.Point).coordinates as [number, number]);
          setPreviewPin(pinData);
          setPreviewPos({ x: point.x, y: point.y });
        }
      });

      // Click on map (not pin) → close preview
      map.on("click", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["imoveis-pins", "clusters"] });
        if (features.length === 0) {
          setPreviewPin(null);
          setPreviewPos(null);
        }
      });

      map.on("mouseenter", "clusters", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "clusters", () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "imoveis-pins", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const id = e.features?.[0]?.properties?.id;
        if (id) onPinHoverRef.current?.(id);
      });
      map.on("mouseleave", "imoveis-pins", () => {
        map.getCanvas().style.cursor = "";
        onPinHoverRef.current?.(null);
      });

      mapReadyRef.current = true;

      const initialBounds = map.getBounds();
      boundsRef.current = initialBounds;
      lastCenterRef.current = { lat: map.getCenter().lat, lng: map.getCenter().lng };

      if (onBoundsChangeRef.current && !initialBoundsReportedRef.current) {
        initialBoundsReportedRef.current = true;
        const sw = initialBounds.getSouthWest();
        const ne = initialBounds.getNorthEast();
        onBoundsChangeRef.current({ lat_min: sw.lat, lat_max: ne.lat, lng_min: sw.lng, lng_max: ne.lng });
      }

      const source = map.getSource("imoveis") as mapboxgl.GeoJSONSource | undefined;
      if (source && pinsRef.current.length > 0) source.setData(toGeoJSON(pinsRef.current));
    });

    map.on("moveend", () => {
      if (!mapReadyRef.current) return;
      boundsRef.current = map.getBounds();

      const newCenter = map.getCenter();
      const distanceMoved = Math.sqrt(
        Math.pow(newCenter.lat - lastCenterRef.current.lat, 2) +
        Math.pow(newCenter.lng - lastCenterRef.current.lng, 2)
      );
      if (distanceMoved > 0.003) {
        setPreviewPin(null);
        setPreviewPos(null);
      }
      lastCenterRef.current = { lat: newCenter.lat, lng: newCenter.lng };

      const sw = boundsRef.current!.getSouthWest();
      const ne = boundsRef.current!.getNorthEast();
      const currentBounds = { lat_min: sw.lat, lat_max: ne.lat, lng_min: sw.lng, lng_max: ne.lng };

      onBoundsChangeRef.current?.(currentBounds);

      if (autoSearchRef.current && onBoundsSearchRef.current) {
        if (autoSearchTimerRef.current) clearTimeout(autoSearchTimerRef.current);
        autoSearchTimerRef.current = window.setTimeout(() => {
          onBoundsSearchRef.current?.(currentBounds);
        }, 800);
      } else {
        setMapMoved(true);
      }
    });

    mapRef.current = map;

    return () => {
      mapReadyRef.current = false;
      if (autoSearchTimerRef.current) clearTimeout(autoSearchTimerRef.current);
      map.remove();
      mapRef.current = null;
      initRef.current = false;
      initialBoundsReportedRef.current = false;
    };
  }, []);

  // Draw helpers
  function updateDrawSources(map: mapboxgl.Map, pts: [number, number][], closed: boolean) {
    const pointsSource = map.getSource("draw-points") as mapboxgl.GeoJSONSource | undefined;
    const polySource = map.getSource("draw-polygon") as mapboxgl.GeoJSONSource | undefined;
    if (pointsSource) {
      pointsSource.setData({
        type: "FeatureCollection",
        features: pts.map(p => ({ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: p }, properties: {} })),
      });
    }
    if (polySource && pts.length >= 3) {
      const ring = closed ? pts : [...pts, pts[0]];
      polySource.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [ring] }, properties: {} }],
      });
    } else if (polySource && pts.length >= 2) {
      polySource.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: pts }, properties: {} }],
      });
    }
  }

  const clearDraw = useCallback(() => {
    setDrawPoints([]);
    setHasDrawn(false);
    setDrawMode(false);
    const map = mapRef.current;
    if (map && mapReadyRef.current) {
      const ps = map.getSource("draw-points") as mapboxgl.GeoJSONSource | undefined;
      const pg = map.getSource("draw-polygon") as mapboxgl.GeoJSONSource | undefined;
      if (ps) ps.setData({ type: "FeatureCollection", features: [] });
      if (pg) pg.setData({ type: "FeatureCollection", features: [] });
    }
    setMapMoved(false);
  }, []);

  const finalizarDesenho = useCallback(() => {
    const map = mapRef.current;
    const finalPoints = drawPointsRef.current;
    if (!map || finalPoints.length < 3) return;

    const closed = [...finalPoints, finalPoints[0]];
    updateDrawSources(map, closed, true);
    setDrawMode(false);
    setHasDrawn(true);
    map.getCanvas().style.cursor = "";

    if (finalPoints.length >= 3 && onBoundsSearchRef.current) {
      const lngs = finalPoints.map(p => p[0]);
      const lats = finalPoints.map(p => p[1]);
      onBoundsSearchRef.current({
        lng_min: Math.min(...lngs), lng_max: Math.max(...lngs),
        lat_min: Math.min(...lats), lat_max: Math.max(...lats),
      });
    }
  }, []);

  // ESC to cancel draw
  useEffect(() => {
    if (!drawMode) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") clearDraw(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drawMode, clearDraw]);

  // Draw mode click handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (drawMode) {
      map.getCanvas().style.cursor = "crosshair";
      const onClick = (e: mapboxgl.MapMouseEvent) => {
        const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        setDrawPoints(prev => { const next = [...prev, point]; updateDrawSources(map, next, false); return next; });
      };
      const onDblClick = (e: mapboxgl.MapMouseEvent) => { e.preventDefault(); finalizarDesenho(); };
      map.on("click", onClick);
      map.on("dblclick", onDblClick);
      map.doubleClickZoom.disable();
      return () => {
        map.off("click", onClick);
        map.off("dblclick", onDblClick);
        map.doubleClickZoom.enable();
        if (!drawMode) map.getCanvas().style.cursor = "";
      };
    } else {
      map.getCanvas().style.cursor = "";
    }
  }, [drawMode, finalizarDesenho]);

  const handleBoundsSearch = useCallback(() => {
    if (!boundsRef.current || !onBoundsSearch) return;
    const sw = boundsRef.current.getSouthWest();
    const ne = boundsRef.current.getNorthEast();
    onBoundsSearch({ lat_min: sw.lat, lat_max: ne.lat, lng_min: sw.lng, lng_max: ne.lng });
    setMapMoved(false);
  }, [onBoundsSearch]);

  const handlePertoDeVoce = useCallback(() => {
    if (!("geolocation" in navigator)) { toast.error("Geolocalização não disponível"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const map = mapRef.current;
        if (map) {
          map.flyTo({ center: [longitude, latitude], zoom: 14, duration: 1200, essential: true });
          userMarkerRef.current?.remove();
          const el = document.createElement("div");
          el.style.cssText = "width:18px;height:18px;background:#5B6CF9;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);";
          userMarkerRef.current = new mapboxgl.Marker(el).setLngLat([longitude, latitude]).addTo(map);
          toast.success("Mapa centralizado na sua localização");
        }
      },
      (err) => {
        const msg = err.code === err.PERMISSION_DENIED
          ? "Permissão de localização negada"
          : "Não foi possível obter localização";
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" style={{ borderRadius: "0" }} />

      {/* React preview popup — matches site exactly */}
      <AnimatePresence>
        {previewPin && previewPos && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute z-30 w-[260px] cursor-pointer"
            style={{
              left: Math.min(Math.max(previewPos.x - 130, 8), (containerRef.current?.offsetWidth ?? 400) - 268),
              top: previewPos.y - 10,
              transform: "translateY(-100%)",
            }}
            onClick={() => onPinClickRef.current?.(previewPin)}
          >
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xl">
              {previewPin.foto_principal ? (
                <img
                  src={previewPin.foto_principal}
                  alt={previewPin.titulo}
                  className="h-[130px] w-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="flex h-[80px] w-full items-center justify-center bg-muted">
                  <span className="text-2xl opacity-30">🏠</span>
                </div>
              )}
              <div className="px-3 py-2.5">
                <p className="text-sm font-bold text-foreground">{formatPreco(previewPin.preco)}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {previewPin.quartos != null && previewPin.quartos > 0 && (
                    <span className="flex items-center gap-0.5"><Bed className="h-3 w-3" />{previewPin.quartos}</span>
                  )}
                  {previewPin.area_total != null && previewPin.area_total > 0 && (
                    <span className="flex items-center gap-0.5"><Maximize className="h-3 w-3" />{previewPin.area_total}m²</span>
                  )}
                  <span>· {previewPin.bairro}</span>
                </div>
                <div className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-center text-[12px] font-bold text-primary-foreground">
                  Ver imóvel →
                </div>
              </div>
            </div>
            {/* Triangle pointer */}
            <div className="flex justify-center">
              <div className="h-2.5 w-2.5 rotate-45 border-b border-r border-border bg-card -mt-[6px]" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom toolbar — draw, nearby, auto-search (same as site) */}
      {onBoundsSearch && !drawMode && !hasDrawn && (
        <div className="absolute bottom-4 left-3 right-14 z-20 flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => { setDrawMode(true); setDrawPoints([]); setHasDrawn(false); }}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-[12px] font-semibold text-muted-foreground shadow-lg transition-all hover:border-foreground/30 active:scale-[0.97]"
          >
            <PenTool className="h-3.5 w-3.5" /> Desenhar área
          </button>
          <button
            onClick={handlePertoDeVoce}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-[12px] font-semibold text-muted-foreground shadow-lg transition-all hover:border-foreground/30 active:scale-[0.97]"
          >
            <Navigation className="h-3.5 w-3.5" /> Perto de você
          </button>
          <button
            onClick={() => setAutoSearch(prev => !prev)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold shadow-lg transition-all active:scale-[0.97] ${
              autoSearch
                ? "border border-primary bg-primary/10 text-primary"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {autoSearch ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
            Buscar ao mover
          </button>
        </div>
      )}

      {/* Draw mode indicator + confirm */}
      <AnimatePresence>
        {drawMode && (
          <div className="absolute left-3 right-3 top-4 z-20 flex flex-wrap items-center gap-2 sm:left-4 sm:right-auto">
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-lg"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              {drawPoints.length < 3
                ? `Clique no mapa para marcar pontos (${drawPoints.length}/3)`
                : `Área com ${drawPoints.length} pontos`}
              <button onClick={clearDraw} className="ml-1 rounded-full p-0.5 hover:bg-white/20">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
            {drawPoints.length >= 3 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={finalizarDesenho}
                className="flex items-center gap-1.5 rounded-full border-2 border-primary bg-card px-4 py-2 text-[13px] font-bold text-primary shadow-lg transition-all hover:bg-primary hover:text-primary-foreground active:scale-[0.96]"
              >
                <Check className="h-4 w-4" /> Buscar nessa área
              </motion.button>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* Clear draw button */}
      <AnimatePresence>
        {hasDrawn && !drawMode && (
          <div className="absolute bottom-4 left-4 z-20">
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={clearDraw}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[13px] font-semibold text-foreground shadow-lg transition-transform hover:shadow-xl active:scale-[0.97]"
            >
              <X className="h-3.5 w-3.5" /> Apagar desenho
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {/* "Buscar nessa região" button — only when NOT auto-searching */}
      <AnimatePresence>
        {mapMoved && onBoundsSearch && !drawMode && !hasDrawn && !autoSearch && (
          <div className="pointer-events-none absolute left-0 right-0 top-4 z-20 flex justify-center">
            <motion.button
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              onClick={handleBoundsSearch}
              className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-[13px] font-semibold text-foreground shadow-lg transition-transform hover:shadow-xl active:scale-[0.97]"
            >
              <Search className="h-3.5 w-3.5" /> Buscar nessa região
            </motion.button>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
