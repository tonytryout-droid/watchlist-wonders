import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Play, Bookmark, Calendar, Sparkles, Clock, Bell } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-background to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        
        {/* Floating Cards Animation */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-32 h-48 bg-card/20 rounded-lg transform -rotate-12 animate-pulse" />
          <div className="absolute top-1/3 right-1/4 w-28 h-40 bg-card/15 rounded-lg transform rotate-6 animate-pulse delay-150" />
          <div className="absolute bottom-1/3 left-1/3 w-24 h-36 bg-card/10 rounded-lg transform rotate-12 animate-pulse delay-300" />
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 text-center">
          {/* Logo/Brand */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="p-3 bg-primary rounded-lg">
              <Play className="w-8 h-8 text-primary-foreground fill-current" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              WatchMarks
            </h1>
          </div>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-4">
            Your personal streaming companion
          </p>
          <p className="text-lg text-muted-foreground/80 max-w-xl mx-auto mb-10">
            Save links from any platform, organize your watchlist, and never forget what to watch next.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="text-lg px-8 py-6"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Get Started Free
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/auth")}
              className="text-lg px-8 py-6"
            >
              Sign In
            </Button>
          </div>

          {/* Scroll Indicator */}
          <div className="animate-bounce">
            <div className="w-6 h-10 border-2 border-muted-foreground/50 rounded-full mx-auto flex justify-center">
              <div className="w-1.5 h-3 bg-muted-foreground/50 rounded-full mt-2 animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-card/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-4">
            Everything You Need
          </h2>
          <p className="text-muted-foreground text-center max-w-xl mx-auto mb-16">
            A beautifully simple way to manage what you want to watch across all your streaming services.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <FeatureCard
              icon={Bookmark}
              title="Save From Anywhere"
              description="Paste any URL from Netflix, YouTube, Prime Video, or any streaming platform. We'll fetch the details automatically."
            />
            <FeatureCard
              icon={Calendar}
              title="Watch Plans"
              description="Create personalized viewing schedules based on your mood, available time, and preferred platforms."
            />
            <FeatureCard
              icon={Sparkles}
              title="Tonight's Pick"
              description="Can't decide what to watch? Get a random suggestion from your backlog based on your current mood."
            />
            <FeatureCard
              icon={Clock}
              title="Runtime Tracking"
              description="Know exactly how long each show or movie is, so you can find the perfect fit for your available time."
            />
            <FeatureCard
              icon={Bell}
              title="Reminders"
              description="Set reminders for upcoming releases or scheduled watch sessions. Never miss what matters."
            />
            <FeatureCard
              icon={Play}
              title="One-Click Play"
              description="Jump straight to your content on its original platform with a single click."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-16">
            How It Works
          </h2>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <StepCard
              step={1}
              title="Paste a Link"
              description="Copy any streaming URL and paste it into WatchMarks. We'll extract all the details."
            />
            <StepCard
              step={2}
              title="Organize"
              description="Add mood tags, notes, and organize your watchlist however you like."
            />
            <StepCard
              step={3}
              title="Watch"
              description="When you're ready, pick from your curated list and enjoy."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-t from-primary/10 to-transparent">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready to Start Watching?
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">
            Join WatchMarks today and take control of your streaming experience.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="text-lg px-8 py-6"
          >
            Create Your Free Account
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-1.5 bg-primary rounded">
              <Play className="w-4 h-4 text-primary-foreground fill-current" />
            </div>
            <span className="text-lg font-semibold text-foreground">WatchMarks</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} WatchMarks. Your personal streaming companion.
          </p>
        </div>
      </footer>
    </div>
  );
};

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors">
      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

interface StepCardProps {
  step: number;
  title: string;
  description: string;
}

function StepCard({ step, title, description }: StepCardProps) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl font-bold text-primary-foreground">{step}</span>
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

export default Index;
