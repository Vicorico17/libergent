interface Product {
  id: string;
  title: string;
  price: number | null;
  platform: string;
  platformColor: string;
  condition: string;
  location: string;
  daysAgo: number;
  postedDateLabel: string;
  image?: string;
  url?: string;
}

interface ProductCardProps {
  product: Product;
  isBestDeal?: boolean;
}

export type { Product };

export function ProductCard({ product, isBestDeal = false }: ProductCardProps) {
  const { title, price, platform, platformColor, condition, location, postedDateLabel, url } = product;
  const hasPrice = price !== null && Number.isFinite(price);

  const conditionColor =
    condition === "Ca nou" || condition === "Nou cu etichetă"
      ? "#4F7CFF"
      : condition === "Bun"
      ? "#22c55e"
      : "#6B6B6B";

  return (
    <div
      className={`bg-white rounded-2xl overflow-hidden hover:shadow-md transition-shadow group ${
        isBestDeal ? "flex flex-col md:flex-row" : "flex flex-col"
      }`}
      style={{
        boxShadow: isBestDeal
          ? "0 8px 20px rgba(255,189,46,0.22), 0 0 0 2px rgba(255,189,46,0.45)"
          : "0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
      }}
    >
      {/* Image */}
      <div
        className={`relative bg-[#F8F9FA] shrink-0 flex items-center justify-center overflow-hidden ${
          isBestDeal ? "w-full md:w-56 lg:w-64 aspect-[4/3] md:aspect-auto md:min-h-[190px]" : "w-full aspect-[4/3]"
        }`}
      >
        {product.image ? (
          <img src={product.image} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-[#D9D9D9]">
            <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
            <circle cx="17" cy="20" r="4" stroke="currentColor" strokeWidth="2" />
            <path d="M6 32l10-8 8 6 6-5 12 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {/* Platform badge */}
        <span
          className="absolute top-2.5 left-2.5 text-white text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: platformColor }}
        >
          {platform}
        </span>
        {isBestDeal ? (
          <span className="absolute left-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-full bg-[#FFBD2E] text-[#111111] text-[11px] font-bold px-2 py-0.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M5 19h14l-1.5-10-4.5 3-3-6-3 6-4.5-3L5 19z" />
            </svg>
            Best deal
          </span>
        ) : null}
      </div>

      {/* Content */}
      <div className={`flex flex-col flex-1 ${isBestDeal ? "p-4 md:p-5 gap-3" : "p-4 gap-2"}`}>
        <p className={`font-semibold text-[#111111] leading-snug line-clamp-2 ${isBestDeal ? "text-base" : "text-sm"}`}>{title}</p>

        <div className={`flex items-center justify-between mt-auto pt-1 ${isBestDeal ? "gap-3" : ""}`}>
          <span
            className={`font-pixel text-[#111111] ${isBestDeal ? "whitespace-nowrap" : ""}`}
            style={{ fontSize: isBestDeal ? "15px" : "14px" }}
          >
            {hasPrice ? `${price.toLocaleString("ro-RO")} RON` : "Fără preț"}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#F8F9FA]" style={{ color: conditionColor }}>
            {condition}
          </span>
        </div>

        <div className={`flex items-center justify-between text-xs text-[#6B6B6B] ${isBestDeal ? "gap-3" : ""}`}>
          <span>{location}</span>
          <span>{postedDateLabel}</span>
        </div>

        <a
          href={url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-1 inline-flex justify-center items-center rounded-xl border border-[#D9D9D9] font-semibold text-[#111111] hover:border-[#4F7CFF] hover:text-[#4F7CFF] transition-colors ${
            isBestDeal ? "h-10 text-sm md:w-44" : "h-9 text-xs"
          }`}
        >
          Vezi anunțul →
        </a>
      </div>
    </div>
  );
}
