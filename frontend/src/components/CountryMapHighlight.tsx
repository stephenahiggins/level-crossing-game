import { memo, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCountryName } from '../lib/countries';
import { getCountryCoordinates } from '../lib/countryCoordinates';

interface CountryMapHighlightProps {
  countryCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  outcome: 'correct' | 'failed';
}

interface ResetViewProps {
  center: LatLngExpression;
  zoom: number;
}

const ResetView = ({ center, zoom }: ResetViewProps) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: false });
  }, [center, map, zoom]);
  return null;
};

export const CountryMapHighlight = memo(function CountryMapHighlight({
  countryCode,
  latitude,
  longitude,
  outcome,
}: CountryMapHighlightProps) {
  const fallbackCoords = useMemo(() => {
    if (!countryCode) return null;
    return getCountryCoordinates(countryCode);
  }, [countryCode]);

  const lat = latitude ?? fallbackCoords?.lat ?? null;
  const lon = longitude ?? fallbackCoords?.lon ?? null;

  const center = useMemo<LatLngExpression | null>(() => {
    if (lat == null || lon == null) {
      return null;
    }
    return [lat, lon];
  }, [lat, lon]);

  if (!center) {
    return null;
  }

  const countryLabel = countryCode ? getCountryName(countryCode) : 'Unknown location';
  const accent = outcome === 'correct' ? '#22c55e' : '#ef4444';
  const halo = outcome === 'correct' ? '#bbf7d0' : '#fecaca';

  return (
    <div className="mt-6 space-y-3">
      <div className="text-lg font-semibold">
        On the map: {countryLabel} ({lat?.toFixed(2)}, {lon?.toFixed(2)})
      </div>
      <div className="relative rounded-3xl overflow-hidden shadow-inner border border-white/20">
        <MapContainer
          key={`${lat}-${lon}`}
          center={center}
          zoom={4}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          touchZoom={false}
          keyboard={false}
          zoomControl={false}
          className="w-full h-64"
          attributionControl={false}
        >
          <ResetView center={center} zoom={4} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <CircleMarker
            center={center}
            radius={30}
            color={halo}
            fillColor={halo}
            weight={0}
            fillOpacity={0.35}
          />
          <CircleMarker
            center={center}
            radius={16}
            color={accent}
            fillColor={accent}
            weight={0}
            fillOpacity={0.55}
          />
          <CircleMarker
            center={center}
            radius={6}
            color="#f8fafc"
            fillColor="#f8fafc"
            weight={2}
            fillOpacity={1}
          />
        </MapContainer>
        <div className="absolute bottom-2 right-3 text-xs text-white/70 bg-black/40 px-2 py-1 rounded">
          Map data © OpenStreetMap contributors
        </div>
      </div>
    </div>
  );
});
