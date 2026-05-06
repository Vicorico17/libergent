interface MascotSVGProps {
  size?: number;
  color?: string;
  className?: string;
}

export function MascotSVG({ size = 64, className = "" }: MascotSVGProps) {
  return (
    <img
      src="/logo.svg"
      width={size}
      style={{ height: "auto" }}
      className={className}
      aria-hidden="true"
      alt=""
    />
  );
}

/* Mascot holding a newspaper — same base, newspaper sticking out right */
export function MascotNewspaper({ size = 64, color = "#111111", className = "" }: MascotSVGProps) {
  const h = Math.round(size * 0.88);
  return (
    <svg
      viewBox="0 0 124 88"
      width={Math.round(size * 1.24)}
      height={h}
      fill="none"
      className={className}
      style={{ imageRendering: "pixelated" }}
      aria-hidden="true"
    >
      {/* LEFT PEAK */}
      <rect x="24" y="0" width="12" height="4" fill={color} />
      <rect x="20" y="4" width="20" height="4" fill={color} />
      <rect x="16" y="8" width="28" height="4" fill={color} />
      <rect x="12" y="12" width="36" height="4" fill={color} />

      {/* RIGHT PEAK */}
      <rect x="64" y="0" width="12" height="4" fill={color} />
      <rect x="60" y="4" width="20" height="4" fill={color} />
      <rect x="56" y="8" width="28" height="4" fill={color} />
      <rect x="52" y="12" width="36" height="4" fill={color} />

      {/* MERGED HEAD */}
      <rect x="8" y="16" width="84" height="4" fill={color} />
      <rect x="4" y="20" width="92" height="4" fill={color} />

      {/* BRIM */}
      <rect x="0" y="24" width="100" height="8" fill={color} />

      {/* LEFT EYE */}
      <rect x="8"  y="24" width="28" height="4" fill="white" />
      <rect x="12" y="28" width="20" height="4" fill="white" />
      <rect x="16" y="32" width="12" height="4" fill="white" />
      <rect x="20" y="36" width="4"  height="2" fill="white" />

      {/* RIGHT EYE */}
      <rect x="64" y="24" width="28" height="4" fill="white" />
      <rect x="68" y="28" width="20" height="4" fill="white" />
      <rect x="72" y="32" width="12" height="4" fill="white" />
      <rect x="76" y="36" width="4"  height="2" fill="white" />

      {/* BODY */}
      <rect x="4"  y="32" width="92" height="8" fill={color} />
      <rect x="8"  y="40" width="84" height="8" fill={color} />
      <rect x="12" y="48" width="76" height="8" fill={color} />
      <rect x="16" y="56" width="68" height="8" fill={color} />
      <rect x="20" y="64" width="60" height="8" fill={color} />
      <rect x="24" y="72" width="52" height="8" fill={color} />
      <rect x="28" y="80" width="44" height="8" fill={color} />

      {/* NEWSPAPER — white rectangle with lines, right side */}
      <rect x="100" y="28" width="24" height="32" fill="white" />
      <rect x="104" y="32" width="16" height="2" fill="#cccccc" />
      <rect x="104" y="36" width="16" height="2" fill="#cccccc" />
      <rect x="104" y="40" width="16" height="2" fill="#cccccc" />
      <rect x="104" y="44" width="16" height="2" fill="#cccccc" />
      <rect x="104" y="48" width="12" height="2" fill="#cccccc" />
      <rect x="104" y="52" width="8"  height="2" fill="#cccccc" />
    </svg>
  );
}

/* Mascot with tall hat — same body, single tall hat replaces M-peaks */
export function MascotTallHat({ size = 64, color = "#111111", className = "" }: MascotSVGProps) {
  const h = Math.round(size * 1.1);
  return (
    <svg
      viewBox="0 0 100 110"
      width={size}
      height={h}
      fill="none"
      className={className}
      style={{ imageRendering: "pixelated" }}
      aria-hidden="true"
    >
      {/* TALL HAT */}
      <rect x="32" y="0" width="36" height="28" fill={color} />
      {/* HAT BRIM */}
      <rect x="16" y="28" width="68" height="6" fill={color} />

      {/* HEAD */}
      <rect x="8"  y="34" width="84" height="4" fill={color} />
      <rect x="4"  y="38" width="92" height="4" fill={color} />

      {/* WIDE BRIM */}
      <rect x="0" y="42" width="100" height="8" fill={color} />

      {/* LEFT EYE */}
      <rect x="8"  y="42" width="28" height="4" fill="white" />
      <rect x="12" y="46" width="20" height="4" fill="white" />
      <rect x="16" y="50" width="12" height="4" fill="white" />
      <rect x="20" y="54" width="4"  height="2" fill="white" />

      {/* RIGHT EYE */}
      <rect x="64" y="42" width="28" height="4" fill="white" />
      <rect x="68" y="46" width="20" height="4" fill="white" />
      <rect x="72" y="50" width="12" height="4" fill="white" />
      <rect x="76" y="54" width="4"  height="2" fill="white" />

      {/* BODY */}
      <rect x="4"  y="50" width="92" height="8" fill={color} />
      <rect x="8"  y="58" width="84" height="8" fill={color} />
      <rect x="12" y="66" width="76" height="8" fill={color} />
      <rect x="16" y="74" width="68" height="8" fill={color} />
      <rect x="20" y="82" width="60" height="8" fill={color} />
      <rect x="24" y="90" width="52" height="8" fill={color} />
      <rect x="28" y="98" width="44" height="8" fill={color} />
      <rect x="32" y="106" width="36" height="4" fill={color} />
    </svg>
  );
}
