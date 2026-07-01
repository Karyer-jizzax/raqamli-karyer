import type { DistrictGeo } from '@karier/api-client';
import { currentLang } from '@karier/i18n';

const MAP_WIDTH = 640;

function name(d: DistrictGeo): string {
  const l = currentLang();
  return l === 'ru' ? d.name_ru : l === 'uz-cyrl' ? d.name_uz_cyrl : d.name_uz_latn;
}

function fillFor(count: number, max: number, selected: boolean): string {
  if (selected) return '#1d3a5c';
  const t = max > 0 ? count / max : 0;
  const light = 92 - Math.round(t * 42);
  return `hsl(212 40% ${light}%)`;
}

export function JizzaxMap({
  districts,
  viewHeight,
  selectedId,
  onSelect,
  onActivate,
  maxHeight,
}: {
  districts: DistrictGeo[];
  viewHeight: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onActivate?: (id: string) => void;
  maxHeight?: number;
}) {
  const max = districts.reduce((m, d) => Math.max(m, d.quarry_count), 0);

  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${viewHeight}`}
      style={{ width: '100%', height: 'auto', display: 'block', maxHeight: maxHeight ?? undefined }}
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
            onDoubleClick={() => onActivate?.(d.id)}
          >
            <title>
              {name(d)} — {d.quarry_count}
            </title>
          </path>
        );
      })}
      {districts.map((d) => {
        if (d.center_x == null || d.center_y == null) return null;
        const selected = d.id === selectedId;
        const labelFill = selected ? '#fff' : '#1d3a5c';
        return (
          <g key={`b-${d.id}`} pointerEvents="none">
            <circle
              cx={d.center_x}
              cy={d.center_y}
              r={17}
              fill="#fff"
              stroke="#1d3a5c"
              strokeWidth={1.4}
              opacity={0.95}
            />
            <text
              x={d.center_x}
              y={d.center_y + 5}
              textAnchor="middle"
              fontSize={15}
              fontWeight={800}
              fill="#1d3a5c"
            >
              {d.quarry_count}
            </text>
            <text
              x={d.center_x}
              y={d.center_y + 30}
              textAnchor="middle"
              fontSize={11}
              fontWeight={800}
              fill={labelFill}
              stroke={selected ? '#1d3a5c' : 'none'}
              strokeWidth={selected ? 2.5 : 0}
              paintOrder="stroke"
              opacity={0.95}
            >
              {name(d)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
