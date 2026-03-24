import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BellRing,
  CalendarDays,
  ChevronDown,
  Sparkles,
  Tv,
  Smartphone,
  Layers,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HERO_TILES = [
  { title: "Dune: Part Two", tone: "from-amber-600/85 via-orange-500/65 to-transparent" },
  { title: "The Bear", tone: "from-red-700/85 via-rose-500/65 to-transparent" },
  { title: "Shogun", tone: "from-slate-500/85 via-zinc-400/65 to-transparent" },
  { title: "Arcane", tone: "from-blue-700/85 via-cyan-500/65 to-transparent" },
  { title: "Wednesday", tone: "from-neutral-700/85 via-zinc-500/65 to-transparent" },
  { title: "Severance", tone: "from-emerald-700/85 via-teal-500/65 to-transparent" },
];

const FEATURES = [
  {
    icon: Tv,
    title: "Enjoy your watchlist on every screen",
    description:
      "Manage your list on desktop, then jump into playback from the source link on mobile, TV browser, or tablet.",
    accent: "from-[#e50914]/20 to-[#141414]",
  },
  {
    icon: Smartphone,
    title: "Set reminders and never miss tonight",
    description:
      "Schedule for tonight, this weekend, or any custom date. WatchMarks keeps your queue moving with timely nudges.",
    accent: "from-sky-500/20 to-[#141414]",
  },
  {
    icon: Layers,
    title: "Create rails like a streaming home",
    description:
      "Group by mood, status, runtime, or platform, then browse with cinematic rails and one-click actions.",
    accent: "from-fuchsia-500/20 to-[#141414]",
  },
];

const FAQ_ITEMS = [
  {
    q: "What is WatchMarks?",
    a: "WatchMarks is a personal watchlist organizer. Save shows and movies from any platform, then browse and schedule them in one place.",
  },
  {
    q: "Is WatchMarks free?",
    a: "Yes. You can start free, add bookmarks instantly, and manage your rails without entering payment details.",
  },
  {
    q: "Which platforms are supported?",
    a: "You can paste links from streaming platforms, social media, and movie databases including YouTube, Netflix, IMDb, and more.",
  },
  {
    q: "Can I access my list on phone and desktop?",
    a: "Yes. Your watchlist syncs across devices so your queue is available anywhere you sign in.",
  },
];

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    if (!loading && user) navigate("/dashboard");
  }, [loading, navigate, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center">
        <div className="text-sm text-white/70 tracking-wide uppercase">Loading WatchMarks...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <header className="fixed top-0 inset-x-0 z-50 bg-black/70 backdrop-blur-md border-b border-white/10">
        <div className="mx-auto max-w-7xl h-[72px] px-4 sm:px-6 lg:px-10 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-[#e50914] text-3xl font-black tracking-tight leading-none"
            aria-label="WatchMarks home"
          >
            WATCHMARKS
          </button>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate("/auth")}
              className="text-white/90 hover:text-white hover:bg-white/10"
            >
              Sign In
            </Button>
            <Button
              onClick={() => navigate("/auth")}
              className="bg-[#e50914] hover:bg-[#f6121d] text-white font-semibold"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-[72px]">
        <section className="relative overflow-hidden border-b-8 border-[#232323]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_8%,rgba(229,9,20,0.22),transparent_40%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black/92" />

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-20 sm:py-24 text-center">
            <p className="text-xs uppercase tracking-[0.28em] text-white/70 font-semibold mb-6">
              Your personal streaming home screen
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.04] max-w-4xl mx-auto">
              Save Anything.
              <br />
              Watch It Your Way.
            </h1>
            <p className="text-base sm:text-lg text-white/80 max-w-2xl mx-auto mt-6">
              Turn scattered streaming links into a cinematic home screen with hero banners, rails, and smart reminders.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="h-12 px-7 text-base font-semibold bg-[#e50914] hover:bg-[#f6121d]"
              >
                Start Free
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth")}
                className="h-12 px-7 text-base border-white/35 bg-white/10 hover:bg-white/20 text-white"
              >
                Sign In
              </Button>
            </div>
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 pb-20">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              {HERO_TILES.map((tile) => (
                <div
                  key={tile.title}
                  className="relative h-44 sm:h-52 rounded-md overflow-hidden border border-white/10 bg-[#1b1b1b] shadow-[0_24px_44px_rgba(0,0,0,0.45)]"
                >
                  <div className={cn("absolute inset-0 bg-gradient-to-t", tile.tone)} />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
                  <div className="absolute left-3 right-3 bottom-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/65 mb-1">Top Pick</p>
                    <p className="text-sm font-semibold leading-tight">{tile.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {FEATURES.map((feature) => (
          <section
            key={feature.title}
            className="border-b-8 border-[#232323] py-14 sm:py-16"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight">{feature.title}</h2>
                <p className="mt-4 text-white/80 text-lg">{feature.description}</p>
              </div>
              <div className={cn("relative rounded-xl border border-white/10 p-5 sm:p-6 bg-gradient-to-br", feature.accent)}>
                <div className="rounded-lg bg-black/55 border border-white/15 p-4">
                  <div className="flex items-center gap-2 text-sm text-white/75 mb-4">
                    <feature.icon className="w-4 h-4 text-[#e50914]" />
                    Experience snapshot
                  </div>
                  <div className="space-y-3">
                    <div className="h-12 rounded bg-white/10 border border-white/10" />
                    <div className="h-12 rounded bg-white/10 border border-white/10" />
                    <div className="h-12 rounded bg-white/10 border border-white/10" />
                  </div>
                  <div className="mt-4 inline-flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-full bg-[#e50914]/20 text-[#ff9aa0] border border-[#e50914]/35">
                    <Sparkles className="w-3.5 h-3.5" />
                    Optimized for rail browsing
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}

        <section className="border-b-8 border-[#232323] py-14 sm:py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-10">
              Frequently Asked Questions
            </h2>
            <div className="space-y-2">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={item.q} className="bg-[#2d2d2d] rounded-sm">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? -1 : index)}
                      className="w-full text-left p-5 sm:p-6 flex items-center justify-between hover:bg-[#3a3a3a] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-inset"
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${index}`}
                      id={`faq-question-${index}`}
                    >
                      <span className="text-lg sm:text-xl font-medium pr-4">{item.q}</span>
                      <ChevronDown className={cn("w-5 h-5 shrink-0 transition-transform", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && (
                      <div
                        id={`faq-answer-${index}`}
                        role="region"
                        aria-labelledby={`faq-question-${index}`}
                        className="px-5 sm:px-6 pb-6 text-white/85 text-base leading-relaxed"
                      >
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-16 text-center">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-10">
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
              Ready to turn your backlog into a streaming home screen?
            </h2>
            <p className="mt-4 text-white/80">
              Create your account and start building rails in minutes.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="h-12 px-8 text-base bg-[#e50914] hover:bg-[#f6121d]"
              >
                Get Started
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth")}
                className="h-12 px-8 text-base border-white/30 bg-white/5 text-white hover:bg-white/15"
              >
                <CalendarDays className="w-4 h-4 mr-2" />
                Set First Reminder
              </Button>
            </div>
            <div className="mt-8 inline-flex items-center gap-2 text-xs text-white/65 uppercase tracking-[0.22em]">
              <BellRing className="w-3.5 h-3.5" />
              Save it now. Watch it tonight.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
