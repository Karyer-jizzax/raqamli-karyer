import type { DistrictGeo } from '@karier/api-client';
import { currentLang } from '@karier/i18n';

const MAP_WIDTH = 640;

function name(d: DistrictGeo): string {
  const l = currentLang();
  return l === 'ru' ? d.name_ru : l === 'uz-cyrl' ? d.name_uz_cyrl : d.name_uz_latn;
}

function fillFor(count: number, max: number, selected: boolean): string {
  if (selected) return '#0f766e';
  const t = max > 0 ? count / max : 0;
  const light = 94 - Math.round(t * 46);
  return `hsl(174 42% ${light}%)`;
}

type Box = { x: number; y: number; w: number; h: number };

/**
 * Bounding box of the drawn shapes. The stored paths are polylines
 * (`M x,y L x,y … Z`), so every number in them is a coordinate: reading the
 * pairs off in order is enough, and a stray control point would only widen the
 * box, never crop the map.
 */
function boundsOf(districts: DistrictGeo[]): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const d of districts) {
    if (!d.svg_path) continue;
    const nums = d.svg_path.match(/-?\d+(?:\.\d+)?/g);
    if (!nums) continue;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = Number(nums[i]);
      const y = Number(nums[i + 1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (minX === Infinity || maxX <= minX || maxY <= minY) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * The region map: one path per district, shaded by how many quarries it holds.
 *
 * `fit` crops the viewBox to the shapes actually drawn. A tuman-scoped account
 * receives its district alone, and a lone district inside the whole region's
 * viewBox would be a speck in a field of white — cropping makes it the map.
 * Badge sizes then scale with the crop, so a zoomed-in district keeps labels
 * the size the eye expects rather than the size the coordinate space implies.
 */
export function RegionMap({
  districts,
  viewHeight,
  selectedId,
  onSelect,
  onActivate,
  maxHeight,
  fit,
}: {
  districts: DistrictGeo[];
  viewHeight: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onActivate?: (id: string) => void;
  maxHeight?: number;
  /** Crop the viewBox to the drawn districts instead of the whole region. */
  fit?: boolean;
}) {
  const max = districts.reduce((m, d) => Math.max(m, d.quarry_count), 0);

  const bounds = fit ? boundsOf(districts) : null;
  // A tenth of the shape as breathing room, so the outline never touches the
  // card's edge and the name badge below the centroid stays inside the frame.
  const pad = bounds ? Math.max(bounds.w, bounds.h) * 0.1 : 0;
  const box: Box = bounds
    ? { x: bounds.x - pad, y: bounds.y - pad, w: bounds.w + pad * 2, h: bounds.h + pad * 2 }
    : { x: 0, y: 0, w: MAP_WIDTH, h: viewHeight };
  const k = box.w / MAP_WIDTH;

  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
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
            // Bir tuman ichida ikkinchisi bo'lishi mumkin (anklav): teshik
            // to'ldirilib ketmasin.
            fillRule="evenodd"
            stroke="#fff"
            strokeWidth={1.4 * k}
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
        const labelFill = selected ? '#fff' : '#334155';
        return (
          <g key={`b-${d.id}`} pointerEvents="none">
            <circle
              cx={d.center_x}
              cy={d.center_y}
              r={17 * k}
              fill="#fff"
              stroke="#0d9488"
              strokeWidth={1.4 * k}
              opacity={0.95}
            />
            <text
              x={d.center_x}
              y={d.center_y + 5 * k}
              textAnchor="middle"
              fontSize={15 * k}
              fontWeight={800}
              fill="#0f766e"
            >
              {d.quarry_count}
            </text>
            <text
              x={d.center_x}
              y={d.center_y + 30 * k}
              textAnchor="middle"
              fontSize={11 * k}
              fontWeight={800}
              fill={labelFill}
              stroke={selected ? '#0f766e' : 'none'}
              strokeWidth={selected ? 2.5 * k : 0}
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
