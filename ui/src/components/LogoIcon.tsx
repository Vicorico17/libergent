export function LogoIcon({
  size = 40,
  className = "",
}: {
  size?: number;
  color?: string;
  eyeColor?: string;
  className?: string;
}) {
  return (
    <img
      src="/logo.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={className}
      style={{ imageRendering: "pixelated", objectFit: "contain" }}
    />
  );
}
