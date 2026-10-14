function clean(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

export function parseNemiraHtml(html, limit = 20, { origin = "https://nemira.ro" } = {}) {
  const items = [];
  const seen = new Set();
  for (const match of String(html || "").matchAll(/<form\b[^>]*class="product_addtocart_form[^"]*"[^>]*>([\s\S]*?)<\/form>/gi)) {
    const block = match[1];
    const info = block.match(/<div class="product-info[^>]*>([\s\S]*?)<div class="flex">/i)?.[1] || "";
    const titleMatch = info.match(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const prices = [...block.matchAll(/<span\b[^>]*data-price-type="(?:finalPrice|oldPrice)"[^>]*>/gi)];
    const finalPrice = prices.find(([tag]) => /data-price-type="finalPrice"/i.test(tag))?.[0];
    // Coupon prices require a code. Keep the advertised regular price when the
    // card supplies only a list price and a conditional coupon offer.
    const couponOnly = !finalPrice && /class="[^"]*\bcoupon-price\b/i.test(block);
    const priceTag = finalPrice || (couponOnly ? prices.find(([tag]) => /data-price-type="oldPrice"/i.test(tag))?.[0] : "");
    const priceMatch = priceTag?.match(/data-price-amount="([0-9.]+)"/i);
    if (!titleMatch || !priceMatch) continue;
    const title = clean(titleMatch[2]);
    const priceValue = Number(priceMatch[1]);
    if (!title || !Number.isFinite(priceValue) || priceValue <= 0) continue;
    let url;
    try { url = new URL(titleMatch[1], origin).href; } catch { continue; }
    if (seen.has(url)) continue;
    seen.add(url);
    const imageMatch = block.match(/<img\b[^>]*class="[^"]*product-image-photo[^"]*"[^>]*src="([^"]+)"/i);
    items.push({ title, price: `${priceValue} RON`, currency: "RON", condition: "Nou", url, imageUrl: imageMatch?.[1] || "",
      ...(couponOnly ? { priceNote: "Preț fără cupon", priceType: "regular_without_coupon" } : {}) });
    if (items.length >= limit) break;
  }
  return { items, rawItemCount: items.length, totalResults: null };
}
