"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SearchClient } from "./SearchClient";

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchClient query="" />}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const query = String(searchParams.get("q") || "").trim();

  return <SearchClient query={query} />;
}
