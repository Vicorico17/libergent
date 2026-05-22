import Image from "next/image";

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
    <Image
      src="/logo.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      unoptimized
      className={className}
      style={{ imageRendering: "pixelated", objectFit: "contain" }}
    />
  );
}
