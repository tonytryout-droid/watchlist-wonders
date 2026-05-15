import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { Activity, Brain, GitBranch, Users, Repeat, Shield } from 'lucide-react';
import { useAdminClaim } from '@/hooks/useAdminClaim';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/admin/health', label: 'System Health', icon: Activity },
  { to: '/admin/users', label: 'User Behavior', icon: Users },
  { to: '/admin/intelligence', label: 'Intelligence Quality', icon: Brain },
  { to: '/admin/graph', label: 'Content Graph', icon: GitBranch },
  { to: '/admin/retention', label: 'Retention', icon: Repeat },
];

export default function AdminLayout() {
  const { loading, isAdmin } = useAdminClaim();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-[1400px] gap-6 px-6 py-8">
        <aside className="w-60 shrink-0">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Admin</h1>
          </div>
          <nav className="space-y-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-white/[0.06] text-white'
                      : 'text-muted-foreground hover:bg-white/[0.03] hover:text-white',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
