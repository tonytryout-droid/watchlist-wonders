import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Check,
  Play,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ─── Animated demo ──────────────────────────────────────────── */

const DEMO_URL = "tiktok.com/@user/funny-movie-clip";
const DEMO_MOVIE = { title: "The Dark Knight", year: "2008", runtime: "2h 32m", tag: "Movie" };
const TYPE_SPEED = 38; // ms per character

type DemoPhase = "idle" | "typing" | "loading" | "found" | "pause";

function LinkToCardDemo() {
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [typed, setTyped] = useState("");
  const [charIdx, setCharIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => { if (timerRef.current) clearTimeout(timerRef.current); };

  useEffect(() => {
    clear();
    if (phase === "idle") {
      timerRef.current = setTimeout(() => { setPhase("typing"); setCharIdx(0); setTyped(""); }, 900);
    } else if (phase === "typing") {
      if (charIdx < DEMO_URL.length) {
        timerRef.current = setTimeout(() => {
          setTyped(DEMO_URL.slice(0, charIdx + 1));
          setCharIdx((c) => c + 1);
        }, TYPE_SPEED);
      } else {
        timerRef.current = setTimeout(() => setPhase("loading"), 400);
      }
    } else if (phase === "loading") {
      timerRef.current = setTimeout(() => setPhase("found"), 1400);
    } else if (phase === "found") {
      timerRef.current = setTimeout(() => { setPhase("idle"); setTyped(""); }, 3200);
    }
    return clear;
  }, [phase, charIdx]);

  return (
    <div className="w-full max-w-xs mx-auto space-y-3 select-none">
      {/* URL input */}
      <div className={cn(
        "flex items-center gap-2 bg-[#1c1c1c] border rounded-xl px-4 py-3 transition-all duration-300",
        phase === "loading" ? "border-[#e50914]/60 shadow-[0_0_16px_rgba(229,9,20,0.18)]" : "border-white/15"
      )}>
        <div className="w-3 h-3 rounded-full bg-[#e50914]/70 shrink-0" />
        <span className="text-sm text-white/90 flex-1 font-mono truncate min-w-0">
          {typed || (
            <span className="text-white/35">Paste a link from anywhere...</span>
          )}
          {(phase === "typing") && (
            <span className="inline-block w-0.5 h-3.5 bg-[#e50914] ml-0.5 animate-pulse align-middle" />
          )}
        </span>
        {phase === "loading" && (
          <Loader2 className="w-4 h-4 text-[#e50914] animate-spin shrink-0" />
        )}
        {(phase === "found") && (
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
        )}
      </div>

      {/* Detecting label */}
      <div className={cn(
        "text-xs text-center transition-all duration-300",
        phase === "loading" ? "text-[#e50914]/80 opacity-100" : "opacity-0 pointer-events-none"
      )}>
        Finding movie details...
      </div>

      {/* Movie card result */}
      <div className={cn(
        "bg-[#1c1c1c] border border-white/10 rounded-xl overflow-hidden transition-all duration-500",
        phase === "found" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      )}>
        <div className="flex items-stretch gap-0">
          {/* Poster */}
          <div className="w-16 shrink-0 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
            <Play className="w-5 h-5 text-white/30 fill-white/20" />
          </div>
          {/* Info */}
          <div className="flex-1 p-3 space-y-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{DEMO_MOVIE.title}</p>
            <p className="text-xs text-white/55">{DEMO_MOVIE.year} · {DEMO_MOVIE.runtime}</p>
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#e50914]/20 text-[#ff9aa0] border border-[#e50914]/20 font-medium">
                {DEMO_MOVIE.tag}
              </span>
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5">
                <Check className="w-2.5 h-2.5" /> Saved
              </span>
            </div>
          </div>
        </div>
        {/* "Watch tonight" bar */}
        <div className="px-3 pb-2.5 pt-0">
          <div className="bg-[#e50914]/10 border border-[#e50914]/20 rounded-lg px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-[#ff9aa0] font-medium">Suggested for tonight</span>
            <ArrowRight className="w-3 h-3 text-[#e50914]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── FAQ ────────────────────────────────────────────────────── */

const FAQ_ITEMS = [
  {
    q: "What exactly is WatchMarks?",
    a: "It's your personal list for movies and shows. You save them, and WatchMarks helps you decide what to watch — instead of scrolling forever trying to remember what you saved.",
  },
  {
    q: "How do I add something to my list?",
    a: "Copy the link from wherever you found it — a TikTok, YouTube video, Netflix title, IMDb page — and paste it in. We find the movie or show automatically. No manual typing.",
  },
  {
    q: "What does 'we tell you what to watch next' mean?",
    a: "WatchMarks looks at what you've saved, how long it is, and your mood — then surfaces the best pick for right now. Short on time? It shows you something under 30 minutes. Want something intense? It filters for that.",
  },
  {
    q: "Is it free?",
    a: "Yes, completely free to start. Save as many links as you want.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. Your list syncs across phone, tablet, and desktop. Save on your phone while scrolling TikTok, watch later on your TV.",
  },
];

/* ─── Main page ──────────────────────────────────────────────── */

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(-1);

  useEffect(() => {
    if (!loading && user) navigate("/dashboard");
  }, [loading, navigate, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">

      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-black/70 backdrop-blur-md border-b border-white/10">
        <div className="mx-auto max-w-7xl h-[68px] px-4 sm:px-6 lg:px-10 flex items-center justify-between">
          <span className="text-[#e50914] text-2xl font-black tracking-tight">WATCHMARKS</span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")} className="text-white/80 hover:text-white hover:bg-white/10">
              Sign in
            </Button>
            <Button onClick={() => navigate("/auth")} className="bg-[#e50914] hover:bg-[#f6121d] text-white font-semibold">
              Start free
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-[68px]">

        {/* ── HERO ──────────────────────────────────────────── */}
        <section className="relative border-b-8 border-[#1e1e1e] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_0%,rgba(229,9,20,0.18),transparent_50%)]" />
          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-16 sm:py-24">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

              {/* Left: words */}
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/50 font-semibold mb-5">
                  Your personal watch list
                </p>
                <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-black leading-[1.06] mb-6">
                  Save movies from anywhere.{" "}
                  <span className="text-[#e50914]">We pick what you watch next.</span>
                </h1>
                <p className="text-lg text-white/75 leading-relaxed mb-3 max-w-lg">
                  See something on TikTok or YouTube? Paste the link — WatchMarks finds the movie and saves it.
                </p>
                <p className="text-lg text-white/75 leading-relaxed mb-10 max-w-lg">
                  When you sit down to watch, we tell you exactly what to put on.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    size="lg"
                    onClick={() => navigate("/auth")}
                    className="h-12 px-8 text-base font-semibold bg-[#e50914] hover:bg-[#f6121d]"
                  >
                    Start free — no card needed
                  </Button>
                </div>
                <p className="mt-4 text-sm text-white/40">Takes 30 seconds to set up.</p>
              </div>

              {/* Right: live demo */}
              <div className="relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(229,9,20,0.1),transparent_70%)]" />
                <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl">
                  <p className="text-xs text-white/40 uppercase tracking-wider font-medium mb-4 text-center">
                    See how it works
                  </p>
                  <LinkToCardDemo />
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────── */}
        <section className="border-b-8 border-[#1e1e1e] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3">
              Three steps. That's it.
            </h2>
            <p className="text-white/60 text-center mb-14 max-w-md mx-auto">
              No setup. No configuration. Just paste a link and go.
            </p>
            <div className="grid sm:grid-cols-3 gap-6 lg:gap-10">
              {[
                {
                  step: "1",
                  headline: "You see something",
                  detail: "A TikTok clip, YouTube video, or someone's IMDb recommendation. Anything.",
                  icon: "👀",
                  color: "border-white/10",
                },
                {
                  step: "2",
                  headline: "Paste the link",
                  detail: "We find the movie or show automatically — title, poster, runtime. You don't type anything.",
                  icon: "📋",
                  color: "border-[#e50914]/30",
                },
                {
                  step: "3",
                  headline: "We tell you what to watch",
                  detail: "Sit down to watch tonight. We surface the best pick from your list based on your mood and time available.",
                  icon: "🎬",
                  color: "border-white/10",
                },
              ].map((item, i) => (
                <div key={i} className="relative">
                  {/* Arrow between steps */}
                  {i < 2 && (
                    <div className="hidden sm:flex absolute -right-5 top-8 z-10 items-center">
                      <ChevronRight className="w-5 h-5 text-white/20" />
                    </div>
                  )}
                  <div className={cn(
                    "h-full bg-[#1c1c1c] border rounded-2xl p-6",
                    item.color
                  )}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl">{item.icon}</span>
                      <span className="text-xs font-bold text-white/30 uppercase tracking-widest">
                        Step {item.step}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">{item.headline}</h3>
                    <p className="text-white/65 leading-relaxed">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHY USE IT ────────────────────────────────────── */}
        <section className="border-b-8 border-[#1e1e1e] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                  Stop wasting 20 minutes deciding what to watch.
                </h2>
                <p className="text-white/65 text-lg leading-relaxed mb-8">
                  You know the feeling. You sit down, open Netflix, scroll for 20 minutes, and end up watching nothing. WatchMarks solves exactly that.
                </p>
                <ul className="space-y-4">
                  {[
                    "Everything you want to watch is in one place — not scattered across your bookmarks, screenshots, and memory.",
                    "We pick the best thing to watch right now, based on how much time you have.",
                    "Your list actually gets used instead of growing forever and being ignored.",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-[#e50914]/20 border border-[#e50914]/30 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-[#e50914]" />
                      </span>
                      <span className="text-white/75">{item}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  onClick={() => navigate("/auth")}
                  className="mt-10 h-12 px-8 bg-[#e50914] hover:bg-[#f6121d] font-semibold"
                >
                  Try it free
                </Button>
              </div>

              {/* Visual: outcome grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "No more decision paralysis", sub: "We pick. You watch.", color: "from-[#e50914]/15", icon: "🎯" },
                  { label: "Works wherever you find things", sub: "TikTok, YouTube, IMDb, anywhere", color: "from-sky-500/15", icon: "🌐" },
                  { label: "Short on time?", sub: "Filter to under 30 min instantly", color: "from-emerald-500/15", icon: "⚡" },
                  { label: "Saved for tonight", sub: "Reminders so you don't forget", color: "from-amber-500/15", icon: "🔔" },
                ].map((card, i) => (
                  <div
                    key={i}
                    className={cn(
                      "bg-gradient-to-br to-[#1c1c1c] border border-white/8 rounded-2xl p-5",
                      card.color
                    )}
                  >
                    <div className="text-2xl mb-3">{card.icon}</div>
                    <p className="text-sm font-semibold text-white mb-1">{card.label}</p>
                    <p className="text-xs text-white/50">{card.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────── */}
        <section className="border-b-8 border-[#1e1e1e] py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-10">Questions</h2>
            <div className="space-y-2">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={item.q} className="bg-[#1e1e1e] rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? -1 : index)}
                      className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-[#252525] transition-colors"
                      aria-expanded={isOpen}
                    >
                      <span className="text-base font-medium pr-4">{item.q}</span>
                      <ChevronDown className={cn("w-4 h-4 text-white/40 shrink-0 transition-transform", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-white/70 leading-relaxed">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────── */}
        <section className="py-20 sm:py-28 text-center">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <h2 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Start with one link.
            </h2>
            <p className="text-white/65 text-lg mb-10">
              Paste the next thing you want to watch. We'll handle the rest.
            </p>
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="h-14 px-10 text-lg font-bold bg-[#e50914] hover:bg-[#f6121d]"
            >
              Get started — it's free
            </Button>
            <p className="mt-5 text-sm text-white/35">No card. No download. Works on any device.</p>
          </div>
        </section>

      </main>
    </div>
  );
};

export default Index;
