import { getFrontendEnv } from "@/lib/frontend-env";

type QueryValue = string | number | boolean | undefined | null;

type QueryParams = Record<string, QueryValue>;

export async function getSinapseJson<T>(path: string, query: QueryParams = {}): Promise<T> {
  const env = getFrontendEnv();
  const url = new URL(path, ensureTrailingSlash(env.apiBaseUrl));

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${env.devJwt}`,
      "X-Tenant-Id": env.devTenantId,
    },
  });

  if (!response.ok) {
    throw new Error(`Sinapse API request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
