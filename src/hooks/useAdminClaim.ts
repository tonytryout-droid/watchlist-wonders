import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface AdminClaimState {
  loading: boolean;
  isAdmin: boolean;
}

export function useAdminClaim(): AdminClaimState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<AdminClaimState>({ loading: true, isAdmin: false });

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    if (!user) {
      if (active) setState({ loading: false, isAdmin: false });
      return;
    }
    user
      .getIdTokenResult()
      .then((result) => {
        if (!active) return;
        setState({ loading: false, isAdmin: result.claims.admin === true });
      })
      .catch(() => {
        if (!active) return;
        setState({ loading: false, isAdmin: false });
      });
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  return state;
}
