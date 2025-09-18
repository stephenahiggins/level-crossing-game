import { memo, useMemo } from 'react';
import { getCountryName } from '../lib/countries';
import { getCountryCoordinates } from '../lib/countryCoordinates';

interface CountryMapHighlightProps {
  countryCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  outcome: 'correct' | 'failed';
}

const WIDTH = 320;
const HEIGHT = 180;

const continents: Array<{ id: string; points: Array<[number, number]> }> = [
  {
    id: 'north-america',
    points: [
      [-168, 72],
      [-52, 72],
      [-40, 50],
      [-60, 15],
      [-100, 10],
      [-145, 20],
      [-168, 40],
    ],
  },
  {
    id: 'south-america',
    points: [
      [-82, 12],
      [-34, 12],
      [-48, -55],
      [-70, -55],
    ],
  },
  {
    id: 'eurasia',
    points: [
      [-10, 72],
      [35, 72],
      [90, 60],
      [130, 55],
      [150, 45],
      [170, 20],
      [160, -5],
      [110, -10],
      [60, -10],
      [30, 5],
      [15, -10],
      [-10, 30],
    ],
  },
  {
    id: 'africa',
    points: [
      [-17, 37],
      [50, 37],
      [40, 5],
      [30, -35],
      [5, -35],
      [-10, -10],
    ],
  },
  {
    id: 'australia',
    points: [
      [110, -10],
      [155, -10],
      [155, -45],
      [115, -45],
    ],
  },
  {
    id: 'greenland',
    points: [
      [-55, 60],
      [-22, 60],
      [-22, 75],
      [-55, 75],
    ],
  },
  {
    id: 'antarctica',
    points: [
      [-180, -60],
      [180, -60],
      [180, -90],
      [-180, -90],
    ],
  },
];

const toPath = (points: Array<[number, number]>): string => {
  if (!points.length) return '';
  const [firstLon, firstLat] = points[0];
  const start = project(firstLon, firstLat);
  const segments = points
    .slice(1)
    .map(([lon, lat]) => {
      const [x, y] = project(lon, lat);
      return `L ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
  return `M ${start[0].toFixed(2)} ${start[1].toFixed(2)} ${segments} Z`;
};

const project = (lon: number, lat: number): [number, number] => {
  const x = ((lon + 180) / 360) * WIDTH;
  const y = ((90 - lat) / 180) * HEIGHT;
  return [x, y];
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

  const highlight = useMemo(() => {
    if (lat == null || lon == null) {
      return null;
    }
    const [cx, cy] = project(lon, lat);
    return { cx, cy };
  }, [lat, lon]);

  if (!highlight) {
    return null;
  }

  const countryLabel = countryCode ? getCountryName(countryCode) : 'Unknown location';
  const accent = outcome === 'correct' ? '#22c55e' : '#ef4444';
  const halo = outcome === 'correct' ? '#bbf7d0' : '#fecaca';

  return (
    <div className="mt-6 space-y-3">
      <div className="text-lg font-semibold">On the map: {countryLabel}</div>
      <div className="relative rounded-3xl overflow-hidden shadow-inner border border-white/20 bg-gradient-to-br from-slate-900 to-slate-800">
        <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block w-full h-auto">
          <rect width={WIDTH} height={HEIGHT} fill="#0f172a" />
          {[...Array(6)].map((_, index) => {
            const lonLine = -150 + index * 60;
            const [x] = project(lonLine, 0);
            return <line key={`lon-${lonLine}`} x1={x} y1={0} x2={x} y2={HEIGHT} stroke="#1e293b" strokeDasharray="4 6" strokeWidth={0.8} />;
          })}
          {[...Array(5)].map((_, index) => {
            const latLine = -60 + index * 30;
            const [, y] = project(0, latLine);
            return <line key={`lat-${latLine}`} x1={0} y1={y} x2={WIDTH} y2={y} stroke="#1e293b" strokeDasharray="4 6" strokeWidth={0.8} />;
          })}
          {continents.map((continent) => (
            <path
              key={continent.id}
              d={toPath(continent.points)}
              fill="#1f2937"
              stroke="#111827"
              strokeWidth={1}
              opacity={0.85}
            />
          ))}
          <circle cx={highlight.cx} cy={highlight.cy} r={26} fill={halo} opacity={0.35} />
          <circle cx={highlight.cx} cy={highlight.cy} r={16} fill={accent} opacity={0.55} />
          <circle cx={highlight.cx} cy={highlight.cy} r={6} fill="#f8fafc" />
        </svg>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 animate-pulse opacity-30" style={{ background: `radial-gradient(circle at ${highlight.cx}px ${highlight.cy}px, ${accent}, transparent 60%)` }} />
        </div>
      </div>
    </div>
  );
});
