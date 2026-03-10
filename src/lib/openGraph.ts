export type OpenGraphMetadata = {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  type?: string;
  canonicalUrl?: string;
  url?: string;
  favicon?: string;
};

/**
 * Fetch Open Graph metadata for a URL using the Microlink API.
 *
 * Microlink runs a headless browser server-side and returns structured
 * JSON — it handles JavaScript-rendered pages and has proper CORS headers
 * for browser use, making it suitable for platforms like Instagram and
 * Facebook that block raw HTTP scrapers.
 */
export const fetchOpenGraphMetadata = async (url: string): Promise<OpenGraphMetadata> => {
  const endpoint = `https://api.microlink.io?url=${encodeURIComponent(url)}&meta=true`;
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });

  if (!response.ok) {
    throw new Error("Unable to fetch URL metadata.");
  }

  const json = await response.json();
  if (json.status !== "success") {
    throw new Error("Unable to fetch URL metadata.");
  }

  const d = json.data ?? {};
  let hostname = "";
  try {
    hostname = new URL(url).hostname.replace("www.", "");
  } catch {
    hostname = url;
  }

  return {
    title: d.title ?? undefined,
    description: d.description ?? undefined,
    image: d.image?.url ?? undefined,
    siteName: d.publisher ?? hostname,
    type: undefined,
    canonicalUrl: d.url ?? url,
    url: d.url ?? url,
    favicon: d.logo?.url ?? undefined,
  };
};
