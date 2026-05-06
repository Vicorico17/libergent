interface Product {
  id: string;
  title: string;
  price: number | null;
  platform: string;
  platformColor: string;
  condition: string;
  location: string;
  daysAgo: number;
  image?: string;
  url?: string;
}

interface ProductCardProps {
  product: Product;
}

export type { Product };

export function ProductCard({ product }: ProductCardProps) {
  const { title, price, platform, platformColor, condition, location, daysAgo, url } = product;
  const hasPrice = price !== null && Number.isFinite(price);

  const conditionColor =
    condition === "Ca nou" || condition === "Nou cu etichetă"
      ? "#4F7CFF"
      : condition === "Bun"
      ? "#22c55e"
      : "#6B6B6B";

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden flex flex-col hover:shadow-md transition-shadow group"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)" }}
    >
      {/* Image */}
      <div className="relative bg-[#F8F9FA] aspect-[4/3] flex items-center justify-center overflow-hidden">
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
        {/* Save button */}
        <button className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              stroke="#FF6B6B"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <p className="text-sm font-semibold text-[#111111] leading-snug line-clamp-2">{title}</p>

        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="font-pixel text-[#111111]" style={{ fontSize: "14px" }}>
            {hasPrice ? `${price.toLocaleString("ro-RO")} RON` : "Fără preț"}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#F8F9FA]" style={{ color: conditionColor }}>
            {condition}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-[#6B6B6B]">
          <span>{location}</span>
          <span>{daysAgo === 0 ? "azi" : `acum ${daysAgo}z`}</span>
        </div>

        <a
          href={url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex justify-center items-center h-9 rounded-xl border border-[#D9D9D9] text-xs font-semibold text-[#111111] hover:border-[#4F7CFF] hover:text-[#4F7CFF] transition-colors"
        >
          Vezi anunțul →
        </a>
      </div>
    </div>
  );
}
