/** Extract only explicit details; never infer condition, category or a currency conversion. */
export function announcementDetails(text: string) {
  const lines = text.trim().split(/\n+/).map((line) => line.trim());
  const title = (lines[0] || '').replace(/^(?:titlu|vând|vand)\s*:?\s+/i, '').slice(0, 120);
  const prices = [...text.matchAll(/(?<![\d.,])([1-9]\d*(?:[,.]\d{1,2})?)\s*(?:lei|ron)\b/gi)];
  const price = prices.length === 1 ? prices[0][1].replace(',', '.') : '';
  const location = lines.find((line) => /^(?:localitate|oraș|oras)\s*:/i.test(line))?.replace(/^[^:]+:\s*/, '').slice(0, 100) || '';
  return { title, price, location };
}
