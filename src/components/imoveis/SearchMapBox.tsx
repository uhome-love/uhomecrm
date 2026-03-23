/**
 * SearchMapBox — Mapbox GL map for the new /imoveis page.
 * Shows clustered price-pill pins with popup previews.
 */

import { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { type MapPin, formatPrecoCompact, formatPreco } from "@/services/siteImoveis";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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
          bairro: i.bairro ?? "", tipo: i.tipo ?? "",
          quartos: i.quartos ?? 0, area: i.area_total ?? 0,
          foto: i.foto_principal ?? "",
        },
      })),
  };
}

function createPillImage(fillColor: string, strokeColor: string): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = 80; canvas.height = 28;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = fillColor; ctx.strokeStyle = strokeColor; ctx.lineWidth = 1.5;
  const r = 14;
  ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(80 - r, 0); ctx.quadraticCurveTo(80, 0, 80, r);
  ctx.lineTo(80, 28 - r); ctx.quadraticCurveTo(80, 28, 80 - r, 28); ctx.lineTo(r, 28);
  ctx.quadraticCurveTo(0, 28, 0, 28 - r); ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  return ctx.getImageData(0, 0, 80, 28);
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
  const [mapMoved, setMapMoved] = useState(false);
  const onBoundsSearchRef = useRef(onBoundsSearch);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onPinHoverRef = useRef(onPinHover);
  const onPinClickRef = useRef(onPinClick);

  useEffect(() => { pinsRef.current = pins; }, [pins]);
  useEffect(() => { onBoundsSearchRef.current = onBoundsSearch; }, [onBoundsSearch]);
  useEffect(() => { onBoundsChangeRef.current = onBoundsChange; }, [onBoundsChange]);
  useEffect(() => { onPinHoverRef.current = onPinHover; }, [onPinHover]);
  useEffect(() => { onPinClickRef.current = onPinClick; }, [onPinClick]);

  // Update pin data when it changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    const source = map.getSource("imoveis") as mapboxgl.GeoJSONSource | undefined;
    if (source) source.setData(toGeoJSON(pins));
  }, [pins]);

  // Update hover highlight
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    map.setFilter("imoveis-pins-hover", ["==", ["get", "id"], hoveredId ?? ""]);
  }, [hoveredId]);

  // Init map
  useEffect(() => {
    if (initRef.current || !containerRef.current) return;
    initRef.current = true;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-51.2177, -30.0346],
      zoom: 11,
      dragRotate: false,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("imoveis", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true, clusterMaxZoom: 13, clusterRadius: 52,
      });

      map.addLayer({
        id: "clusters", type: "circle", source: "imoveis",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "hsl(var(--primary))",
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

      // Events
      map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0].properties!.cluster_id;
        (map.getSource("imoveis") as mapboxgl.GeoJSONSource).getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          map.easeTo({ center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom! });
        });
      });

      map.on("click", "imoveis-pins", (e) => {
        const props = e.features?.[0]?.properties;
        if (!props) return;
        const pinData = pinsRef.current.find(p => p.id === props.id);
        if (pinData) onPinClickRef.current?.(pinData);
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

      // Set initial data
      const source = map.getSource("imoveis") as mapboxgl.GeoJSONSource | undefined;
      if (source && pinsRef.current.length > 0) source.setData(toGeoJSON(pinsRef.current));

      // Report initial bounds
      const b = map.getBounds();
      onBoundsChangeRef.current?.({
        lat_min: b.getSouthWest().lat, lat_max: b.getNorthEast().lat,
        lng_min: b.getSouthWest().lng, lng_max: b.getNorthEast().lng,
      });
    });

    map.on("moveend", () => {
      if (!mapReadyRef.current) return;
      const b = map.getBounds();
      const bounds = {
        lat_min: b.getSouthWest().lat, lat_max: b.getNorthEast().lat,
        lng_min: b.getSouthWest().lng, lng_max: b.getNorthEast().lng,
      };
      onBoundsChangeRef.current?.(bounds);
      setMapMoved(true);
    });

    mapRef.current = map;

    return () => {
      mapReadyRef.current = false;
      map.remove();
      mapRef.current = null;
      initRef.current = false;
    };
  }, []);

  const handleSearchArea = useCallback(() => {
    if (!mapRef.current) return;
    const b = mapRef.current.getBounds();
    onBoundsSearchRef.current?.({
      lat_min: b.getSouthWest().lat, lat_max: b.getNorthEast().lat,
      lng_min: b.getSouthWest().lng, lng_max: b.getNorthEast().lng,
    });
    setMapMoved(false);
  }, []);

  const handlePertoDeVoce = useCallback(() => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocalização não disponível");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14, duration: 1200 });
        toast.success("Mapa centralizado na sua localização");
      },
      () => toast.error("Não foi possível obter localização"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Controls overlay */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        <AnimatePresence>
          {mapMoved && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Button size="sm" onClick={handleSearchArea} className="rounded-full shadow-lg gap-1.5 text-xs font-semibold">
                <Search className="h-3.5 w-3.5" /> Buscar nessa área
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          size="sm" variant="secondary"
          onClick={handlePertoDeVoce}
          className="rounded-full shadow-lg gap-1.5 text-xs w-fit"
        >
          <Navigation className="h-3.5 w-3.5" /> Perto de mim
        </Button>
      </div>
    </div>
  );
}
