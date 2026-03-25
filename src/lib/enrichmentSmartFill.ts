export type MatchConfidence = 'high' | 'medium' | 'low' | 'unknown';

export interface EnrichmentMatchCandidate {
  tmdbId: number;
  title: string;
  mediaType: 'movie' | 'tv';
  releaseYear?: number;
  posterUrl?: string;
  backdropUrl?: string;
  description?: string;
  voteAverage?: number;
  runtimeMinutes?: number;
  genres?: string[];
  score?: number;
}

export interface SmartFillData {
  description: string | null;
  tags: string[];
  moodTags: string[];
  releaseYear: number | null;
  canonicalUrl: string | null;
  metadata: Record<string, unknown>;
  matchCandidates: EnrichmentMatchCandidate[];
  matchConfidence: MatchConfidence;
}

const GENRE_TO_MOODS: Record<string, string[]> = {
  action: ['action', 'intense', 'epic'],
  adventure: ['epic', 'action', 'uplifting'],
  animation: ['animation', 'family', 'fun'],
  comedy: ['comedy', 'fun', 'uplifting'],
  crime: ['dark', 'thriller', 'thoughtful'],
  documentary: ['documentary', 'educational', 'thoughtful'],
  drama: ['drama', 'emotional', 'thoughtful'],
  family: ['family', 'uplifting', 'fun'],
  fantasy: ['fantasy', 'epic', 'inspiring'],
  history: ['thoughtful', 'educational', 'inspiring'],
  horror: ['horror', 'dark', 'intense'],
  mystery: ['thriller', 'thoughtful', 'dark'],
  music: ['uplifting', 'emotional', 'inspiring'],
  romance: ['romance', 'emotional', 'uplifting'],
  'science fiction': ['scifi', 'intense', 'thoughtful'],
  thriller: ['thriller', 'intense', 'dark'],
  war: ['intense', 'dark', 'thoughtful'],
  western: ['epic', 'action', 'nostalgic'],
};

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeTag(value: string): string {
  return value.trim().replace(/^#+/, '').toLowerCase();
}

export function normalizeHashtags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const tag = normalizeTag(raw);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 16) break;
  }
  return tags;
}

export function normalizeGenres(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const genres: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const genre = raw.trim();
    if (!genre) continue;
    const key = genre.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    genres.push(genre);
  }
  return genres;
}

export function mapGenresToMoodTags(genres: string[]): string[] {
  const moods: string[] = [];
  const seen = new Set<string>();
  for (const genre of genres) {
    const mapped = GENRE_TO_MOODS[genre.toLowerCase()] ?? [];
    for (const mood of mapped) {
      if (seen.has(mood)) continue;
      seen.add(mood);
      moods.push(mood);
      if (moods.length >= 5) return moods;
    }
  }
  return moods;
}

function normalizeMatchConfidence(value: unknown): MatchConfidence {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'unknown';
}

export function parseMatchCandidates(input: unknown): EnrichmentMatchCandidate[] {
  if (!Array.isArray(input)) return [];
  const candidates: EnrichmentMatchCandidate[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const tmdbId = asNumber(item.tmdbId);
    const title = asString(item.title);
    const mediaType = item.mediaType === 'tv' ? 'tv' : item.mediaType === 'movie' ? 'movie' : null;
    if (!tmdbId || !title || !mediaType) continue;

    const genres = normalizeGenres(item.genres);
    candidates.push({
      tmdbId,
      title,
      mediaType,
      releaseYear: asNumber(item.releaseYear) ?? undefined,
      posterUrl: asString(item.posterUrl) ?? undefined,
      backdropUrl: asString(item.backdropUrl) ?? undefined,
      description: asString(item.description) ?? undefined,
      voteAverage: asNumber(item.voteAverage) ?? undefined,
      runtimeMinutes: asNumber(item.runtimeMinutes) ?? undefined,
      genres: genres.length ? genres : undefined,
      score: asNumber(item.score) ?? undefined,
    });
  }
  return candidates;
}

export function buildSmartFillData(raw: Record<string, unknown>): SmartFillData {
  const description = asString(raw.description);
  const releaseYear = asNumber(raw.releaseYear);
  const canonicalUrl = asString(raw.canonicalUrl);
  const genres = normalizeGenres(raw.genres);
  const moodTags = mapGenresToMoodTags(genres);
  const tags = normalizeHashtags(raw.hashtags);
  const matchCandidates = parseMatchCandidates(raw.matchCandidates);
  const matchConfidence = normalizeMatchConfidence(raw.matchConfidence);

  const tmdbId = asNumber(raw.tmdbId);
  const backdropUrl = asString(raw.backdropUrl);
  const posterUrl = asString(raw.posterUrl);
  const voteAverage = asNumber(raw.voteAverage);

  const metadata: Record<string, unknown> = {
    ...(tmdbId ? { tmdb_id: tmdbId } : {}),
    ...(backdropUrl ? { backdrop_url: backdropUrl } : {}),
    ...(posterUrl ? { poster_url: posterUrl } : {}),
    ...(description ? { overview: description } : {}),
    ...(voteAverage !== null ? { vote_average: voteAverage } : {}),
    ...(genres.length ? { genres } : {}),
    ...(matchConfidence !== 'unknown' ? { match_confidence: matchConfidence } : {}),
    ...(matchCandidates.length ? { match_candidates: matchCandidates } : {}),
  };

  return {
    description,
    tags,
    moodTags,
    releaseYear: releaseYear !== null ? releaseYear : null,
    canonicalUrl,
    metadata,
    matchCandidates,
    matchConfidence,
  };
}
