import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Eye } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import type { ShowcaseImovel } from "./types";

interface Props {
  imoveis: ShowcaseImovel[];
  onViewDetails: (item: ShowcaseImovel) => void;
}

function createPriceIcon(valor: number | null) {
  const label = valor ? `R$ ${(valor / 1000).toFixed(0)}k` : "📍";
  return L.divIcon({
    className: "showcase-map-pin",
    html: `<div style="
      background: linear-gradient(135deg, #1e3a5f, #2563eb);
      color: white;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 20px;
      white-space: nowrap;
      box-shadow: 0 4px 15px rgba(37,99,235,0.4);
      border: 2px solid white;
      transform: translate(-50%, -100%);
    ">${label}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export default function ShowcaseMap({ imoveis, onViewDetails }: Props) {
  const geoImoveis = useMemo(
    () => (imoveis || []).filter(i => i?.lat && i?.lng),
    [imoveis]
  );

  if (geoImoveis.length === 0) return null;

  const center: [number, number] = [
    geoImoveis.reduce((s, i) => s + (i.lat || 0), 0) / geoImoveis.length,
    geoImoveis.reduce((s, i) => s + (i.lng || 0), 0) / geoImoveis.length,
  ];

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-8 pb-8">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <MapPin className="h-4 w-4 text-blue-500" />
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Localização</p>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Veja no mapa</h2>
      </div>

      <div className="rounded-3xl overflow-hidden" style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.08)", border: "1px solid #e2e8f0" }}>
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: "400px", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geoImoveis.map((item) => (
            <Marker
              key={item.id}
              position={[item.lat!, item.lng!]}
              icon={createPriceIcon(item.valor)}
            >
              <Popup>
                <div style={{ width: "220px", padding: 0 }}>
                  {item.fotos?.[0] && (
                    <img src={item.fotos[0]} alt="" className="w-full h-28 object-cover rounded-t-lg" />
                  )}
                  <div className="p-3">
                    <p className="font-bold text-sm text-slate-800">{item.empreendimento || item.titulo}</p>
                    {item.bairro && <p className="text-xs text-slate-500 mt-0.5">{item.bairro}</p>}
                    {item.valor && <p className="text-sm font-black text-blue-600 mt-1">{formatBRL(item.valor)}</p>}
                    <button
                      onClick={() => onViewDetails(item)}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #1e3a5f, #2563eb)" }}
                    >
                      <Eye className="h-3 w-3" /> Ver detalhes
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <style>{`
        .showcase-map-pin { background: none !important; border: none !important; }
        .leaflet-popup-content-wrapper { padding: 0 !important; border-radius: 12px !important; overflow: hidden; }
        .leaflet-popup-content { margin: 0 !important; width: auto !important; }
        .leaflet-popup-tip-container { display: none; }
      `}</style>
    </section>
  );
}
