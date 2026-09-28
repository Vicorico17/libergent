export function parsePlaybikeHtml(html, limit) {
  const stateText = html.match(/window\[['"]plyPageData['"]\]\s*=\s*(\{[\s\S]*?\});<\/script>/i)?.[1] || "";
  let products = [];
  try { products = JSON.parse(stateText)?.productList?.items || []; } catch {
    return { items: [], totalResults: null, rawItemCount: 0, hasNextPage: null };
  }
  const items = products.filter((product) => product && product.availabilityStatus !== "red" &&
    product.availabilityLabelKey !== "availability-out-of-stock")
    .map((product) => {
      const priceBani = Number(product.price);
      if (!product.name || !/^https:\/\/www\.playbike\.ro\/produs\//.test(product.url || "") ||
        !Number.isFinite(priceBani) || priceBani <= 0) return null;
      return { title: product.name, price: `${Number((priceBani / 100).toFixed(2))} RON`, currency: "RON",
        location: "", postedAt: "", condition: "Nou", sellerType: "PlayBike",
        url: product.url, imageUrl: "" };
    }).filter(Boolean).slice(0, limit);
  return { items, totalResults: products.length, rawItemCount: products.length, hasNextPage: null };
}
