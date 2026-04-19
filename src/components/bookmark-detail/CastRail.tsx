interface CastMember {
  name: string;
  character?: string;
  profileUrl?: string | null;
}

interface CastRailProps {
  cast: CastMember[];
  director?: string | null;
}

export function CastRail({ cast, director }: CastRailProps) {
  if (cast.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Top Cast
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
        {cast.slice(0, 8).map((actor) => (
          <div key={actor.name} className="shrink-0 w-[100px]">
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted mb-2 ring-1 ring-white/10">
              {actor.profileUrl ? (
                <img
                  src={actor.profileUrl}
                  alt={actor.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                  {actor.name.charAt(0)}
                </div>
              )}
            </div>
            <p className="text-xs font-semibold leading-tight truncate">{actor.name}</p>
            <p className="text-[10px] text-muted-foreground leading-tight truncate">{actor.character}</p>
          </div>
        ))}
      </div>
      {director && (
        <p className="text-xs text-muted-foreground mt-3">
          Directed by{" "}
          <span className="text-foreground font-medium">{director}</span>
        </p>
      )}
    </div>
  );
}
