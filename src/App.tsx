import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import PageTransition from "@/components/layout/PageTransition";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotificationListenerMount } from "@/hooks/useNotificationListener";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { FEATURES } from "@/config/features";

const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Auth = lazy(() => import("./pages/Auth"));
const NewBookmark = lazy(() => import("./pages/NewBookmark"));
const TonightPick = lazy(() => import("./pages/TonightPick"));
const Plans = lazy(() => import("./pages/Plans"));
const PlanDetail = lazy(() => import("./pages/PlanDetail"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Calendar = lazy(() => import("./pages/Calendar"));
const BookmarkDetail = lazy(() => import("./pages/BookmarkDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const ShareView = lazy(() => import("./pages/ShareView"));
const Stats = lazy(() => import("./pages/Stats"));
const Vault = lazy(() => import("./pages/Vault"));
const ShareTarget = lazy(() => import("./pages/ShareTarget"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Activity = lazy(() => import("./pages/Activity"));
const Import = lazy(() => import("./pages/Import"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminSystemHealth = lazy(() => import("./pages/admin/SystemHealth"));
const AdminUserBehavior = lazy(() => import("./pages/admin/UserBehavior"));
const AdminIntelligenceQuality = lazy(() => import("./pages/admin/IntelligenceQuality"));
const AdminContentGraph = lazy(() => import("./pages/admin/ContentGraph"));
const AdminRetention = lazy(() => import("./pages/admin/Retention"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <LoadingSpinner size="lg" />
  </div>
);

function AuthErrorGate({ children }: { children: React.ReactNode }) {
  const { authError } = useAuth();
  if (authError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-destructive font-semibold">Authentication Error</p>
          <p className="text-muted-foreground text-sm">{authError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm text-primary underline underline-offset-4"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AuthErrorGate>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <NotificationListenerMount />
          <div className="dark">
            <PageTransition>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<ErrorBoundary><Index /></ErrorBoundary>} />
                  <Route path="/auth" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
                  <Route path="/terms" element={<ErrorBoundary><Terms /></ErrorBoundary>} />
                  <Route path="/privacy" element={<ErrorBoundary><Privacy /></ErrorBoundary>} />
                  {/* Public routes */}
                  {FEATURES.socialFeatures && (
                    <Route path="/u/:uid" element={<ErrorBoundary><PublicProfile /></ErrorBoundary>} />
                  )}
                  {FEATURES.socialFeatures && (
                    <Route path="/share/:token" element={<ErrorBoundary><ShareView /></ErrorBoundary>} />
                  )}
                  {/* PWA Web Share Target — handles its own auth redirect */}
                  <Route path="/share-target" element={<ErrorBoundary><ShareTarget /></ErrorBoundary>} />
                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                      {/* ── Core routes (always on) ── */}
                      <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                      <Route path="/new" element={<ErrorBoundary><NewBookmark /></ErrorBoundary>} />
                      <Route path="/b/:id" element={<ErrorBoundary><BookmarkDetail /></ErrorBoundary>} />
                      <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
                      {FEATURES.tonightPick && (
                        <Route path="/tonight" element={<ErrorBoundary><TonightPick /></ErrorBoundary>} />
                      )}
                      {/* ── Dimmed-down routes ── */}
                      {FEATURES.vault && (
                        <Route path="/vault" element={<ErrorBoundary><Vault /></ErrorBoundary>} />
                      )}
                      {FEATURES.watchPlans && (
                        <Route path="/plans" element={<ErrorBoundary><Plans /></ErrorBoundary>} />
                      )}
                      {FEATURES.watchPlans && (
                        <Route path="/plans/:id" element={<ErrorBoundary><PlanDetail /></ErrorBoundary>} />
                      )}
                      {FEATURES.notifications && (
                        <Route path="/notifications" element={<ErrorBoundary><Notifications /></ErrorBoundary>} />
                      )}
                      {FEATURES.scheduling && (
                        <Route path="/calendar" element={<ErrorBoundary><Calendar /></ErrorBoundary>} />
                      )}
                      {FEATURES.stats && (
                        <Route path="/stats" element={<ErrorBoundary><Stats /></ErrorBoundary>} />
                      )}
                      {FEATURES.activityLog && (
                        <Route path="/activity" element={<ErrorBoundary><Activity /></ErrorBoundary>} />
                      )}
                      {FEATURES.importBookmarks && (
                        <Route path="/import" element={<ErrorBoundary><Import /></ErrorBoundary>} />
                      )}
                    </Route>
                    {/* Admin dashboard — gated by admin custom claim inside AdminLayout */}
                    <Route path="/admin" element={<ErrorBoundary><AdminLayout /></ErrorBoundary>}>
                      <Route index element={<ErrorBoundary><AdminSystemHealth /></ErrorBoundary>} />
                      <Route path="health" element={<ErrorBoundary><AdminSystemHealth /></ErrorBoundary>} />
                      <Route path="users" element={<ErrorBoundary><AdminUserBehavior /></ErrorBoundary>} />
                      <Route path="intelligence" element={<ErrorBoundary><AdminIntelligenceQuality /></ErrorBoundary>} />
                      <Route path="graph" element={<ErrorBoundary><AdminContentGraph /></ErrorBoundary>} />
                      <Route path="retention" element={<ErrorBoundary><AdminRetention /></ErrorBoundary>} />
                    </Route>
                  </Route>
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<ErrorBoundary><NotFound /></ErrorBoundary>} />
                </Routes>
              </Suspense>
            </PageTransition>
          </div>
        </BrowserRouter>
      </TooltipProvider>
      </AuthErrorGate>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
