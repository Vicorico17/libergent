import { getSupabaseBrowserClient } from './supabase-browser';

export type SellPhoto = { url: string; name: string; file?: File; uploadedUrl?: string };
export type SellProduct = { title: string; description: string; price: string; location: string; category: string; condition: string };
export type Publication = { platform: string; status: string; message: string; url?: string; provider_status?: string };
export type OlxSettings = { categoryId: number; cityId: number; districtId?: number; advertiserType: string; attributes: { code: string; value?: string | number; values?: string[] }[] };
export const publicationLabels: Record<string, string> = { sending: 'Trimitere în curs — verifică în contul OLX', published: 'Publicat', pending: 'În așteptare la OLX', inactive: 'Inactiv pe OLX', rejected: 'Respins de moderarea OLX', failed: 'Respins — poți corecta și reîncerca', unknown: 'Rezultat neconfirmat — verifică în contul OLX', feed_ready: 'În feed — așteaptă importul Okazii', error: 'Necesită atenție' };

export async function sellingRequest(path: string, method = 'GET', body?: unknown) {
  const client = getSupabaseBrowserClient();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (!session) throw new Error('Autentifică-te în LiberGent pentru a conecta conturi și a publica.');
  const response = await fetch(`/api/selling${path}`, {
    method, headers: { authorization: `Bearer ${session.access_token}`, ...(body instanceof File ? { 'content-type': body.type } : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: body instanceof File ? body : JSON.stringify(body) })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Cererea nu a putut fi finalizată.');
  return data;
}
export function postingText(listing: SellProduct) {
  return `${listing.title.trim()}\n\n${listing.description.trim()}\n\nPreț: ${listing.price} RON\nStare: ${listing.condition}\nLocalitate: ${listing.location.trim()}`;
}
