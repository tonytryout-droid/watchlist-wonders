import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type Profile = Database['public']['Tables']['public_profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['public_profiles']['Update'];

export const authService = {
  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, metadata?: { username?: string; display_name?: string }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign out the current user
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get the current user session
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * Get the current user
   */
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },

  /**
   * Reset password via email
   */
  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) throw error;
  },

  /**
   * Update password
   */
  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

export const profileService = {
  /**
   * Get the current user's profile
   */
  async getProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('public_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data as Profile;
  },

  /**
   * Get a profile by username
   */
  async getProfileByUsername(username: string) {
    const { data, error } = await supabase
      .from('public_profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error) throw error;
    return data as Profile;
  },

  /**
   * Update the current user's profile
   */
  async updateProfile(updates: ProfileUpdate) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('public_profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  },

  /**
   * Create a profile for a new user
   */
  async createProfile(userId: string, username: string, displayName?: string) {
    const { data, error } = await supabase
      .from('public_profiles')
      .insert({
        id: userId,
        username,
        display_name: displayName,
      })
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  },

  /**
   * Check if username is available
   */
  async isUsernameAvailable(username: string) {
    const { data, error } = await supabase
      .from('public_profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    return !data;
  },
};
