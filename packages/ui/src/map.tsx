import type { DistrictGeo } from '@karier/api-client';
import { currentLang } from '@karier/i18n';

const MAP_WIDTH = 640;

function name(d: DistrictGeo): string {
  const l = currentLang();
  return l === 'ru' ? d.name_ru : l === 'uz-cyrl' ? d.name_uz_cyrl : d.name_uz_latn;
}

// Navy tint scaled by quarry count (matches the demo's single serious tone).
function fillFor(count: number, max: number, selected: boolean): string {
  if (selected) return '#1d3a5c';
  const t = max > 0 ? count / max : 0;
  const light = 92 - Math.round(t * 42); // 92% → 50% lightness
  return `hsl(212 40% ${light}%)`;
}

export function JizzaxMap({
  districts,
  viewHeight,
  selectedId,
  onSelect,
}: {
  districts: DistrictGeo[];
  viewHeight: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const max = districts.reduce((m, d) => Math.max(m, d.quarry_count), 0);

  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${viewHeight}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {districts.map((d) => {
        if (!d.svg_path) return null;
        const selected = d.id === selectedId;
        return (
          <path
            key={d.id}
            d={d.svg_path}
            fill={fillFor(d.quarry_count, max, selected)}
            stroke="#fff"
            strokeWidth={1.4}
            style={{ cursor: onSelect ? 'pointer' : 'default', transition: 'fill .15s' }}
            onClick={() => onSelect?.(d.id)}
          >
            <title>
              {name(d)} — {d.quarry_count}
            </title>
          </path>
        );
      })}
      {districts.map((d) =>
        d.center_x != null && d.center_y != null ? (
          <g key={`b-${d.id}`} pointerEvents="none">
            <circle
              cx={d.center_x}
              cy={d.center_y}
              r={13}
              fill="#fff"
              stroke="#1d3a5c"
              strokeWidth={1.2}
              opacity={0.95}
            />
            <text
              x={d.center_x}
              y={d.center_y + 4}
              textAnchor="middle"
              fontSize={12}
              fontWeight={800}
              fill="#1d3a5c"
            >
              {d.quarry_count}
            </text>
          </g>
        ) : null,
      )}
    </svg>
  );
}
