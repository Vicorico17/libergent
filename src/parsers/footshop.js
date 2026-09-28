export function parseFootshopHtml(html, limit) {
  const script = html.match(/<script\b[^>]*data-hypernova-key=["']ProductListing["'][^>]*>([\s\S]*?)<\/script>/i)?.[1] || "";
  let products = [];
  try {
    const payload = JSON.parse(script.replace(/^<!--/, "").replace(/-->$/, ""));
    products = payload?.data?.state?.products?.items || [];
  } catch {
    return { items: [], totalResults: null, rawItemCount: 0, hasNextPage: null };
  }
  const items = products.filter((product) => product && product.sold_out !== true && product.in_stock !== false)
    .map((product) => {
      const price = Number(product.price?.value);
      const path = String(product.url || "").replace(/^\/+/, "");
      if (!product.name || !/^[-\w]+\/.+\.html(?:\?.*)?$/.test(path) || !Number.isFinite(price) || price <= 0) return null;
      return {
        title: product.name,
        price: `${price} ${product.price?.currency_code || "RON"}`,
        currency: product.price?.currency_code || "RON",
        location: "", postedAt: "", condition: "Nou", sellerType: "Footshop",
        url: `https://www.footshop.ro/ro/${path}`,
        imageUrl: product.image || ""
      };
    }).filter(Boolean).slice(0, limit);
  return { items, totalResults: products.length, rawItemCount: products.length, hasNextPage: null };
}
