import { SearchClient } from "./SearchClient";
import { mapProducts, type SearchPayload } from "./search-data";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = String(params.q || "").trim();

  if (!query) {
    return <SearchClient query="" initialProducts={[]} />;
  }

  const payload = await fetchSearch(query);

  return (
    <SearchClient
      query={query}
      initialProducts={payload.error ? [] : mapProducts(payload).slice(0, 120)}
      initialError={payload.error}
      searchedAt={payload.summary?.searchedAt}
    />
  );
}

async function fetchSearch(query: string): Promise<SearchPayload> {
  try {
    const params = new URLSearchParams({
      q: query,
      site: "default",
      provider: "auto",
      limit: "500",
    });
    const response = await fetch(
      `${process.env.LIBERGENT_API_BASE || "http://127.0.0.1:8787"}/api/search?${params.toString()}`,
      { cache: "no-store" }
    );
    const payload = (await response.json()) as SearchPayload;

    if (!response.ok || payload.error) {
      return { error: payload.error || "Căutarea nu a putut fi finalizată." };
    }

    return payload;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Căutarea nu a putut fi finalizată.",
    };
  }
}
