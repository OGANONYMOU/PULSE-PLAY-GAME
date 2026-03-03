import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, RealtimeChannel } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  discord_username: string | null;
  twitter_username: string | null;
  role: 'USER' | 'ADMIN' | 'MODERATOR';
  is_banned: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    metadata: { username: string; first_name?: string; last_name?: string; phone?: string }
  ) => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: 'google' | 'twitter' | 'discord' | 'facebook') => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('Profile fetch error:', error?.message);
      return null;
    }

    const p = data as Profile;
    setProfile(p);
    return p;
  }, []);

  // Subscribe to realtime profile changes (role updates reflect immediately)
  const subscribeToProfile = useCallback((userId: string) => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
    }

    const channel = supabase
      .channel('profile-changes-' + userId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'id=eq.' + userId },
        (payload) => {
          setProfile(payload.new as Profile);
        }
      )
      .subscribe();

    setRealtimeChannel(channel);
  }, []); // eslint-disable-line

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
        subscribeToProfile(session.user.id);
      }

      setIsLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);
        // Small delay to let trigger create the profile row
        setTimeout(async () => {
          await fetchProfile(session.user.id);
          subscribeToProfile(session.user.id);
        }, 500);
      } else {
        setUser(null);
        setProfile(null);
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
      }

      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, []); // eslint-disable-line

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id);
  };

  const updateProfile = async (data: Partial<Profile>): Promise<{ error: Error | null }> => {
    if (!user?.id) return { error: new Error('Not authenticated') };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('profiles') as any).update(data).eq('id', user.id);
    if (!error) await fetchProfile(user.id);
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (
    email: string,
    password: string,
    metadata: { username: string; first_name?: string; last_name?: string; phone?: string }
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    return { error: error as Error | null };
  };

  const handleSignInWithOAuth = async (provider: 'google' | 'twitter' | 'discord' | 'facebook') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/auth/callback' },
    });
    return { error: error as Error | null };
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: profile?.role === 'ADMIN' || profile?.role === 'MODERATOR',
        signIn,
        signUp,
        signInWithOAuth: handleSignInWithOAuth,
        signOut: handleSignOut,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}