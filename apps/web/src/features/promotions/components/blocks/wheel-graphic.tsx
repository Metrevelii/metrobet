import { cn } from '@metrobet/ui';

const R = 96;
const LABEL_RADIUS = 66;

/** Point on the circle `angle` degrees clockwise from 12 o'clock. */
function point(angle: number, radius = R) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return `${(radius * Math.cos(rad)).toFixed(3)} ${(radius * Math.sin(rad)).toFixed(3)}`;
}

// Odd segment counts get three colours so neighbours never match.
const EVEN = ['fill-primary', 'fill-secondary'];
const ODD = ['fill-primary', 'fill-secondary', 'fill-accent'];

type WheelGraphicProps = {
  labels: readonly string[];
  /** Short unit under each value, e.g. "FS". */
  unit: string;
  /** Clockwise rotation of the wheel in degrees. */
  rotation: number;
  /** Spin duration in ms; 0 = jump (no animation). */
  duration: number;
  className?: string;
};

/** Prize wheel drawn in SVG with theme colours. The pointer is fixed at the top. */
export function WheelGraphic({ labels, unit, rotation, duration, className }: WheelGraphicProps) {
  const size = 360 / labels.length;
  const colors = labels.length % 2 === 0 ? EVEN : ODD;
  return (
    <svg viewBox="-100 -108 200 210" className={cn('w-full', className)} aria-hidden>
      <circle r={R + 4} className="fill-border" />
      <g
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: duration ? `transform ${duration}ms cubic-bezier(0.15, 0.7, 0.1, 1)` : 'none',
        }}
      >
        {labels.map((label, index) => {
          const start = index * size;
          const color = colors[index % colors.length]!;
          const onPrimary = color === 'fill-primary';
          return (
            <g key={index}>
              <path
                d={`M0 0 L${point(start)} A${R} ${R} 0 0 1 ${point(start + size)} Z`}
                className={cn(color, 'stroke-card stroke-[0.6]')}
              />
              <g transform={`rotate(${start + size / 2}) translate(0 -${LABEL_RADIUS})`}>
                <text
                  textAnchor="middle"
                  className={cn(
                    'text-[17px] font-bold',
                    onPrimary ? 'fill-primary-foreground' : 'fill-foreground',
                  )}
                >
                  {label}
                </text>
                <text
                  y={11}
                  textAnchor="middle"
                  className={cn(
                    'text-[8px] font-semibold',
                    onPrimary ? 'fill-primary-foreground' : 'fill-muted-foreground',
                  )}
                >
                  {unit}
                </text>
              </g>
            </g>
          );
        })}
      </g>
      <circle r={16} className="fill-card stroke-border stroke-2" />
      <circle r={5} className="fill-primary" />
      <path d="M-9 -106 L9 -106 L0 -88 Z" className="fill-foreground stroke-card stroke-1" />
    </svg>
  );
}
