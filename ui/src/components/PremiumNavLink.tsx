import Link from "next/link";

export function PremiumNavLink({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/pricing"
      onClick={onClick}
      aria-label="Premium — 50% reducere"
      className="inline-flex min-h-11 w-fit shrink-0 items-center gap-2 border border-[#111111] bg-[#FF4B8B] px-3 py-2 text-[#111111] shadow-[3px_3px_0_#111111] transition-colors hover:bg-[#ff72a4] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111111]"
    >
      <span className="text-[10px] font-bold uppercase tracking-wider">Premium</span>
      <span className="border border-[#111111] bg-[#111111] px-1.5 py-1 text-[9px] font-bold leading-none tracking-normal text-white">50% OFF</span>
    </Link>
  );
}
