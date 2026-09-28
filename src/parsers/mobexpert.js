export function parseMobexpertHtml(html, limit) {
  const products = [...html.matchAll(/searchResult\.push\((\{[\s\S]*?\})\);/g)].flatMap((match) => {
    try { return [JSON.parse(match[1])]; } catch { return []; }
  });
  const items = products.filter((product) => product && product.available !== false)
    .map((product) => {
      const priceBani = Number(product.price);
      const handle = String(product.handle || "");
      if (!product.title || !/^[a-z0-9][a-z0-9-]*$/i.test(handle) || !Number.isFinite(priceBani) || priceBani <= 0) return null;
      const image = product.featured_image || product.images?.[0] || "";
      return {
        title: product.title,
        price: `${Number((priceBani / 100).toFixed(2))} RON`, currency: "RON",
        location: "", postedAt: "", condition: "Nou", sellerType: "Mobexpert",
        url: `https://mobexpert.ro/products/${handle}`,
        imageUrl: image.startsWith("//") ? `https:${image}` : image
      };
    }).filter(Boolean).slice(0, limit);
  return { items, totalResults: null, rawItemCount: products.length, hasNextPage: null };
}
