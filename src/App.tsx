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
                  <Route path="/u/:uid" element={<ErrorBoundary><PublicProfile /></ErrorBoundary>} />
                  <Route path="/share/:token" element={<ErrorBoundary><ShareView /></ErrorBoundary>} />
                  {/* PWA Web Share Target — handles its own auth redirect */}
                  <Route path="/share-target" element={<ErrorBoundary><ShareTarget /></ErrorBoundary>} />
                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                      <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                      <Route path="/vault" element={<ErrorBoundary><Vault /></ErrorBoundary>} />
                      <Route path="/new" element={<ErrorBoundary><NewBookmark /></ErrorBoundary>} />
                      <Route path="/tonight" element={<ErrorBoundary><TonightPick /></ErrorBoundary>} />
                      <Route path="/plans" element={<ErrorBoundary><Plans /></ErrorBoundary>} />
                      <Route path="/plans/:id" element={<ErrorBoundary><PlanDetail /></ErrorBoundary>} />
                      <Route path="/notifications" element={<ErrorBoundary><Notifications /></ErrorBoundary>} />
                      <Route path="/calendar" element={<ErrorBoundary><Calendar /></ErrorBoundary>} />
                      <Route path="/b/:id" element={<ErrorBoundary><BookmarkDetail /></ErrorBoundary>} />
                      <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
                      <Route path="/stats" element={<ErrorBoundary><Stats /></ErrorBoundary>} />
                      <Route path="/activity" element={<ErrorBoundary><Activity /></ErrorBoundary>} />
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
