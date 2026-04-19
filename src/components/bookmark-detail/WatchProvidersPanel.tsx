import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BookmarkAvailability } from "@/services/watchAvailability";

interface FallbackSearchUrls {
  google: string;
  youtube: string;
  web: string;
}

interface WatchProvidersPanelProps {
  availability: BookmarkAvailability | null;
  region: string;
  fallbackSearch: FallbackSearchUrls;
  onOpenLink: (url: string) => void;
}

export function WatchProvidersPanel({ availability, region, fallbackSearch, onOpenLink }: WatchProvidersPanelProps) {
  const availableNow = availability?.providers.filter((p) => p.type === "subscription") ?? [];
  const rentOrBuy = availability?.providers.filter((p) => p.type !== "subscription") ?? [];

  return (
    <div className="rounded-xl bg-muted/30 border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Where You Can Watch ({availability?.region ?? region})
      </p>

      {availableNow.length > 0 ? (
        <div className="space-y-2">
          {availableNow.slice(0, 4).map((provider) => (
            <div
              key={`${provider.providerId}-${provider.type}`}
              className="flex items-center justify-between rounded-lg bg-background/70 border border-border px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                {provider.logoUrl && (
                  <img src={provider.logoUrl} alt={provider.name} className="w-5 h-5 rounded-sm" />
                )}
                <span className="text-sm font-medium truncate">{provider.name}</span>
              </div>
              <Button size="sm" variant="secondary" onClick={() => onOpenLink(provider.url)} className="gap-1">
                <ExternalLink className="w-3 h-3" />
                Watch
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Not available on subscription platforms right now.</p>
      )}

      {rentOrBuy.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rent or Buy</p>
          {rentOrBuy.slice(0, 4).map((provider) => (
            <div
              key={`${provider.providerId}-${provider.type}`}
              className="flex items-center justify-between rounded-lg bg-background/70 border border-border px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                {provider.logoUrl && (
                  <img src={provider.logoUrl} alt={provider.name} className="w-5 h-5 rounded-sm" />
                )}
                <span className="text-sm font-medium truncate">{provider.name}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => onOpenLink(provider.url)} className="gap-1">
                <ExternalLink className="w-3 h-3" />
                {provider.type === "rent" ? "Rent" : "Buy"}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Search Elsewhere</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenLink(fallbackSearch.google)}>Search on Google</Button>
          <Button variant="outline" size="sm" onClick={() => onOpenLink(fallbackSearch.youtube)}>Search on YouTube</Button>
          <Button variant="outline" size="sm" onClick={() => onOpenLink(fallbackSearch.web)}>Search on Web</Button>
        </div>
      </div>
    </div>
  );
}
