import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  variant?: "poster" | "backdrop";
  className?: string;
}

export function SkeletonCard({ variant = "poster", className }: SkeletonCardProps) {
  const aspectRatio = variant === "poster" ? "aspect-[2/3]" : "aspect-video";
  const width = variant === "poster" ? "w-32 sm:w-36 md:w-40 lg:w-44" : "w-60 sm:w-72 md:w-80";

  return (
    <div className={cn("flex-shrink-0 rounded-md overflow-hidden", width, className)}>
      <div className={cn("relative bg-muted animate-pulse", aspectRatio)}>
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/10 to-transparent animate-shimmer" />
      </div>
      <div className="p-2 space-y-2">
        <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
        <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonRail({ count = 6 }: { count?: number }) {
  return (
    <section className="py-4">
      <div className="container mx-auto px-4 lg:px-8 mb-3">
        <div className="h-6 bg-muted rounded animate-pulse w-40" />
      </div>
      <div className="flex gap-3 px-4 lg:px-8 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </section>
  );
}
