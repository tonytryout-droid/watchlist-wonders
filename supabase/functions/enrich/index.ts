const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EnrichResult = {
  ok: boolean;
  provider: string;
  canonicalUrl: string;
  title?: string;
  posterUrl?: string;
  runtimeMinutes?: number | null;
  metadata?: Record<string, unknown>;
  blocked?: boolean;
  error?: { message: string; step?: string; status?: number };
};

const jsonResponse = (payload: EnrichResult, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const detectProvider = (url: URL) => {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtube.com" || host === "youtu.be") return "youtube";
  if (host.endsWith("instagram.com")) return "instagram";
  if (host.endsWith("facebook.com") || host === "fb.watch" || host === "fb.com") return "facebook";
  if (host === "x.com" || host === "twitter.com") return "x";
  if (host.endsWith("imdb.com")) return "imdb";
  if (host.endsWith("netflix.com")) return "netflix";
  return "generic";
};

const fetchHtml = async (url: string) => {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    return { ok: false as const, status: response.status, contentType, text: "" };
  }
  if (!contentType.includes("text/html")) {
    const text = await response.text().catch(() => "");
    return { ok: false as const, status: response.status, contentType, text };
  }

  const text = await response.text();
  return { ok: true as const, status: response.status, contentType, text };
};

const extractMeta = (html: string, attribute: string, key: string) => {
  const regex = new RegExp(
    `<meta[^>]+${attribute}=["']${key}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  return html.match(regex)?.[1];
};

const extractOg = (html: string) => {
  const title =
    extractMeta(html, "property", "og:title") ||
    extractMeta(html, "name", "twitter:title");
  const image =
    extractMeta(html, "property", "og:image") ||
    extractMeta(html, "name", "twitter:image");
  const description =
    extractMeta(html, "property", "og:description") ||
    extractMeta(html, "name", "twitter:description");
  const siteName = extractMeta(html, "property", "og:site_name");
  const type = extractMeta(html, "property", "og:type");
  const url = extractMeta(html, "property", "og:url");
  return { title, image, description, siteName, type, url };
};

const tryYouTubeOEmbed = async (canonicalUrl: string) => {
  const endpoint =
    "https://www.youtube.com/oembed?format=json&url=" +
    encodeURIComponent(canonicalUrl);
  const response = await fetch(endpoint, { redirect: "follow" });
  if (!response.ok) return null;
  const data = await response.json();
  return {
    title: data.title as string | undefined,
    posterUrl: data.thumbnail_url as string | undefined,
    metadata: { oembed: data },
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        provider: "unknown",
        canonicalUrl: "",
        error: { message: "Method not allowed" },
      },
      405
    );
  }

  try {
    const { url } = (await req.json()) as { url?: string };

    if (!url) {
      return jsonResponse(
        {
          ok: false,
          provider: "unknown",
          canonicalUrl: "",
          error: { message: "Missing url" },
        },
        400
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return jsonResponse(
        {
          ok: false,
          provider: "unknown",
          canonicalUrl: "",
          error: { message: "Invalid URL" },
        },
        400
      );
    }

    const provider = detectProvider(parsed);
    const canonicalUrl = parsed.toString();

    if (provider === "youtube") {
      const oembed = await tryYouTubeOEmbed(canonicalUrl);
      if (oembed?.title || oembed?.posterUrl) {
        return jsonResponse({
          ok: true,
          provider,
          canonicalUrl,
          title: oembed.title,
          posterUrl: oembed.posterUrl,
          runtimeMinutes: null,
          metadata: oembed.metadata,
        });
      }
    }

    const htmlRes = await fetchHtml(canonicalUrl);
    if (!htmlRes.ok) {
      const blocked = htmlRes.status === 401 || htmlRes.status === 403 || htmlRes.status === 429;
      return jsonResponse({
        ok: false,
        provider,
        canonicalUrl,
        blocked,
        error: {
          message: "HTML fetch failed",
          step: "fetchHtml",
          status: htmlRes.status,
        },
      });
    }

    const og = extractOg(htmlRes.text);
    if (!og.title && !og.image && !og.description) {
      return jsonResponse({
        ok: false,
        provider,
        canonicalUrl,
        error: { message: "No OG metadata found", step: "extractOg" },
      });
    }

    return jsonResponse({
      ok: true,
      provider,
      canonicalUrl,
      title: og.title,
      posterUrl: og.image,
      runtimeMinutes: null,
      metadata: { og },
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        provider: "unknown",
        canonicalUrl: "",
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          step: "catch",
        },
      },
      500
    );
  }
});
