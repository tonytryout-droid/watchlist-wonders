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
  blockReason?: string;
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

// User agent variants for multi-pass fetching
const USER_AGENTS = {
  chrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  mobile: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  bot: "Mozilla/5.0 (compatible; MetadataBot/1.0; +https://example.com/bot)",
  facebook: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
};

const detectProvider = (url: URL) => {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtube.com" || host === "youtu.be") return "youtube";
  if (host.endsWith("instagram.com")) return "instagram";
  if (host.endsWith("facebook.com") || host === "fb.watch" || host === "fb.com") return "facebook";
  if (host === "x.com" || host === "twitter.com") return "x";
  if (host.endsWith("tiktok.com") || host === "vm.tiktok.com") return "tiktok";
  if (host.endsWith("imdb.com")) return "imdb";
  if (host.endsWith("netflix.com")) return "netflix";
  return "generic";
};

// Detect if URL is specifically a Reel
const isReelUrl = (url: URL, provider: string): boolean => {
  const path = url.pathname.toLowerCase();
  
  if (provider === "instagram") {
    // instagram.com/reel/<shortcode>/ or instagram.com/reels/<id>/
    return path.includes("/reel/") || path.includes("/reels/");
  }
  
  if (provider === "facebook") {
    // facebook.com/reel/<id> or facebook.com/reels/<id> or fb.watch/<slug>
    return path.includes("/reel/") || path.includes("/reels/") || url.hostname === "fb.watch";
  }
  
  return false;
};

// Extract title from URL slug as fallback
const extractTitleFromUrl = (url: URL, provider: string): string | undefined => {
  const path = url.pathname;
  
  // Try to get a meaningful slug
  const segments = path.split("/").filter(Boolean);
  
  if (provider === "instagram" || provider === "facebook") {
    // For reels, we can't extract meaningful title from shortcodes
    // But we can return a placeholder
    const shortcode = segments[segments.length - 1];
    if (shortcode && shortcode.length > 3) {
      return `${provider.charAt(0).toUpperCase() + provider.slice(1)} Reel`;
    }
  }
  
  return undefined;
};

// Detect login walls and blocked content
const detectLoginWall = (html: string): { blocked: boolean; reason?: string } => {
  const lowerHtml = html.toLowerCase();
  
  // Instagram login wall indicators
  const loginIndicators = [
    "login to see this",
    "log in to instagram",
    "log in to facebook",
    "create an account",
    "sign up to see",
    "content isn't available",
    "this page isn't available",
    "sorry, this page isn't available",
    "this content isn't available",
    '"require_login":true',
    "loginform",
    "login_form",
  ];
  
  for (const indicator of loginIndicators) {
    if (lowerHtml.includes(indicator)) {
      return { blocked: true, reason: "Login required by platform" };
    }
  }
  
  // Check for very thin HTML (anti-bot response)
  if (html.length < 1000 && !html.includes("og:")) {
    return { blocked: true, reason: "Blocked by platform (thin response)" };
  }
  
  return { blocked: false };
};

// Multi-pass HTML fetcher with different user agents
const fetchHtmlMultiPass = async (url: string) => {
  const attempts = [
    { ua: USER_AGENTS.facebook, name: "facebook-bot" },
    { ua: USER_AGENTS.chrome, name: "chrome" },
    { ua: USER_AGENTS.mobile, name: "mobile" },
  ];
  
  let lastResult: { ok: boolean; status: number; contentType: string; text: string; blocked?: boolean; blockReason?: string } | null = null;
  
  for (const attempt of attempts) {
    console.log(`Fetch attempt with ${attempt.name} UA`);
    
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": attempt.ua,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
        },
      });
      
      const contentType = response.headers.get("content-type") || "";
      
      if (!response.ok) {
        const blocked = response.status === 401 || response.status === 403 || response.status === 429;
        lastResult = { 
          ok: false, 
          status: response.status, 
          contentType, 
          text: "",
          blocked,
          blockReason: blocked ? `HTTP ${response.status}` : undefined,
        };
        continue;
      }
      
      if (!contentType.includes("text/html")) {
        lastResult = { ok: false, status: response.status, contentType, text: "" };
        continue;
      }
      
      const text = await response.text();
      
      // Check for login wall
      const loginCheck = detectLoginWall(text);
      if (loginCheck.blocked) {
        console.log(`Login wall detected with ${attempt.name}: ${loginCheck.reason}`);
        lastResult = { 
          ok: false, 
          status: response.status, 
          contentType, 
          text,
          blocked: true,
          blockReason: loginCheck.reason,
        };
        continue;
      }
      
      // Success! Return this result
      return { ok: true as const, status: response.status, contentType, text };
    } catch (error) {
      console.log(`Fetch error with ${attempt.name}:`, error);
      continue;
    }
  }
  
  // Return last result if all attempts failed
  return lastResult || { ok: false as const, status: 0, contentType: "", text: "", blocked: true, blockReason: "All fetch attempts failed" };
};

// Simple single-pass fetch for non-problematic providers
const fetchHtml = async (url: string) => {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": USER_AGENTS.chrome,
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
  // Try both quote styles and both attribute orders
  const patterns = [
    new RegExp(`<meta[^>]+${attribute}=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${key}["']`, "i"),
  ];
  
  for (const regex of patterns) {
    const match = html.match(regex);
    if (match?.[1]) return match[1];
  }
  return undefined;
};

const extractOg = (html: string) => {
  const title =
    extractMeta(html, "property", "og:title") ||
    extractMeta(html, "name", "twitter:title");
  const image =
    extractMeta(html, "property", "og:image") ||
    extractMeta(html, "name", "twitter:image") ||
    extractMeta(html, "property", "og:image:url");
  const description =
    extractMeta(html, "property", "og:description") ||
    extractMeta(html, "name", "twitter:description");
  const siteName = extractMeta(html, "property", "og:site_name");
  const type = extractMeta(html, "property", "og:type");
  const url = extractMeta(html, "property", "og:url");
  const video = extractMeta(html, "property", "og:video") || 
    extractMeta(html, "property", "og:video:url");
  
  return { title, image, description, siteName, type, url, video };
};

// Extract HTML title tag as last resort
const extractHtmlTitle = (html: string): string | undefined => {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim();
};

const tryOEmbed = async (provider: string, canonicalUrl: string) => {
  let endpoint: string;
  
  switch (provider) {
    case "youtube":
      endpoint = "https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(canonicalUrl);
      break;
    case "x":
      endpoint = "https://publish.twitter.com/oembed?url=" + encodeURIComponent(canonicalUrl);
      break;
    case "tiktok":
      endpoint = "https://www.tiktok.com/oembed?url=" + encodeURIComponent(canonicalUrl);
      break;
    default:
      return null;
  }

  try {
    const response = await fetch(endpoint, { 
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENTS.bot,
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      title: data.title || data.author_name as string | undefined,
      posterUrl: data.thumbnail_url as string | undefined,
      metadata: { oembed: data },
    };
  } catch {
    return null;
  }
};

const tryFirecrawl = async (url: string) => {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) {
    console.log("FIRECRAWL_API_KEY not configured");
    return null;
  }

  try {
    console.log("Using Firecrawl for:", url);
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html"],
        onlyMainContent: false,
        waitFor: 5000, // Wait longer for JS to render
        timeout: 30000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log("Firecrawl request failed:", response.status, errorText);
      return null;
    }

    const result = await response.json();
    const data = result.data || result;
    const metadata = data.metadata || {};

    console.log("Firecrawl metadata:", JSON.stringify(metadata));

    return {
      title: metadata.title || metadata.ogTitle,
      posterUrl: metadata.ogImage || metadata.image,
      description: metadata.description || metadata.ogDescription,
      metadata: { firecrawl: metadata },
    };
  } catch (error) {
    console.error("Firecrawl error:", error);
    return null;
  }
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
    const isReel = isReelUrl(parsed, provider);
    
    console.log(`Enriching: provider=${provider}, isReel=${isReel}, url=${canonicalUrl}`);

    // Tier 1: Try oEmbed for supported providers (YouTube, X, TikTok)
    if (provider === "youtube" || provider === "x" || provider === "tiktok") {
      const oembed = await tryOEmbed(provider, canonicalUrl);
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

    // For Instagram/Facebook: Use enhanced multi-tier approach
    if (provider === "instagram" || provider === "facebook") {
      console.log(`Using enhanced enrichment for ${provider} (isReel: ${isReel})`);
      
      // Tier 2a: Try Firecrawl first (best for anti-bot bypass)
      const firecrawlResult = await tryFirecrawl(canonicalUrl);
      if (firecrawlResult?.title || firecrawlResult?.posterUrl) {
        return jsonResponse({
          ok: true,
          provider,
          canonicalUrl,
          title: firecrawlResult.title,
          posterUrl: firecrawlResult.posterUrl,
          runtimeMinutes: null,
          metadata: { ...firecrawlResult.metadata, isReel },
        });
      }
      
      // Tier 2b: Multi-pass HTML fetching with different user agents
      console.log("Firecrawl failed, trying multi-pass HTML fetch");
      const htmlRes = await fetchHtmlMultiPass(canonicalUrl);
      
      if (htmlRes.ok) {
        const og = extractOg(htmlRes.text);
        const htmlTitle = extractHtmlTitle(htmlRes.text);
        const fallbackTitle = extractTitleFromUrl(parsed, provider);
        
        const title = og.title || htmlTitle || fallbackTitle;
        const posterUrl = og.image;
        
        if (title || posterUrl) {
          return jsonResponse({
            ok: true,
            provider,
            canonicalUrl,
            title,
            posterUrl,
            runtimeMinutes: null,
            metadata: { og, isReel },
          });
        }
      }
      
      // All tiers failed for IG/FB - return blocked response
      return jsonResponse({
        ok: false,
        provider,
        canonicalUrl,
        blocked: true,
        blockReason: htmlRes.blockReason || "Platform blocked metadata access",
        title: extractTitleFromUrl(parsed, provider), // Provide fallback title from URL
        metadata: { isReel },
        error: {
          message: "Unable to fetch metadata - platform restrictions",
          step: "instagram-facebook-enrichment",
        },
      });
    }

    // Standard flow for other providers
    const htmlRes = await fetchHtml(canonicalUrl);
    if (!htmlRes.ok) {
      const blocked = htmlRes.status === 401 || htmlRes.status === 403 || htmlRes.status === 429;
      return jsonResponse({
        ok: false,
        provider,
        canonicalUrl,
        blocked,
        blockReason: blocked ? `HTTP ${htmlRes.status}` : undefined,
        error: {
          message: "HTML fetch failed",
          step: "fetchHtml",
          status: htmlRes.status,
        },
      });
    }

    const og = extractOg(htmlRes.text);
    const htmlTitle = extractHtmlTitle(htmlRes.text);
    
    if (!og.title && !og.image && !og.description && !htmlTitle) {
      return jsonResponse({
        ok: false,
        provider,
        canonicalUrl,
        error: { message: "No metadata found", step: "extractOg" },
      });
    }

    return jsonResponse({
      ok: true,
      provider,
      canonicalUrl,
      title: og.title || htmlTitle,
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
