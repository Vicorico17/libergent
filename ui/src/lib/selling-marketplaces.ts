export const sellingMarketplaces = [
  { name: 'OLX', url: 'https://www.olx.ro/', categories: null },
  { name: 'Facebook Marketplace', url: 'https://www.facebook.com/marketplace/', categories: null },
  { name: 'Publi24', url: 'https://www.publi24.ro/', categories: null },
  { name: 'LaJumate', url: 'https://lajumate.ro/', categories: null },
  { name: 'Okazii', url: 'https://www.okazii.ro/', categories: null },
  { name: 'Anunțul.ro', url: 'https://www.anuntul.ro/', categories: null },
  { name: 'Vinted', url: 'https://www.vinted.ro/', categories: ['Modă și accesorii', 'Copii'] },
  { name: 'Autovit', url: 'https://www.autovit.ro/', categories: ['Auto'] },
];
export function recommendedMarketplaces(category: string) {
  return sellingMarketplaces.filter((market) => !market.categories || market.categories.includes(category)).map((market) => market.name);
}
