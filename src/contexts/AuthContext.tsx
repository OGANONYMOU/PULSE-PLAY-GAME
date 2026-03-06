import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

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
  signUp: (email: string, password: string, metadata: {
    username: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: 'google' | 'twitter' | 'discord' | 'facebook') => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // isLoading only tracks whether we know the *auth state* yet — NOT profile loading.
  const [isLoading, setIsLoading] = useState(true);
  // Guard against double-fetch: init() and onAuthStateChange both fire on mount.
  const initDone = useRef(false);
  const fetchingProfile = useRef(false);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    if (fetchingProfile.current) return null;
    fetchingProfile.current = true;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) {
        console.error('[Auth] fetchProfile error:', error.message, error.code);
        return null;
      }
      const p = data as Profile;
      setProfile(p);
      return p;
    } catch (err) {
      console.error('[Auth] fetchProfile threw:', err);
      return null;
    } finally {
      fetchingProfile.current = false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // ── FIX 1: Hard timeout — unblock the app even if Supabase is slow/offline ──
    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('[Auth] Loading timeout — unblocking app render');
        setIsLoading(false);
        initDone.current = true;
      }
    }, 4000);

    // ── FIX 2: Unblock the UI right after getSession() — don't wait for profile ──
    // The auth state (logged in / not) is all that routing logic needs.
    // Profile data loads in the background; pages that need it show their own skeletons.
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        clearTimeout(loadingTimeout);

        if (session?.user) {
          setUser(session.user);
          setIsLoading(false);       // ← unblock UI immediately
          initDone.current = true;
          fetchProfile(session.user.id); // ← profile loads in background
        } else {
          setIsLoading(false);
          initDone.current = true;
        }
      } catch (err) {
        console.error('[Auth] init error:', err);
        clearTimeout(loadingTimeout);
        if (mounted) setIsLoading(false);
        initDone.current = true;
      }
    };

    init();

    // ── FIX 3: Skip the initial onAuthStateChange fire (init() already handles it) ──
    // Without this guard, both init() AND onAuthStateChange call fetchProfile()
    // for the same session simultaneously — causing two parallel Supabase queries
    // and a potential state flicker.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (!initDone.current) return; // let init() handle the first check

      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      if (mounted) setIsLoading(false);
    });

    const channel = supabase
      .channel('auth-profile-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        if (!mounted) return;
        setProfile((prev) => {
          if (prev && payload.new && (payload.new as Profile).id === prev.id) {
            return payload.new as Profile;
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchProfile]);

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id);
  };

  const updateProfile = async (data: Partial<Profile>): Promise<{ error: Error | null }> => {
    if (!user?.id) return { error: new Error('Not authenticated') };
    const { error } = await supabase
      .from('profiles')
      .update(data as never)
      .eq('id', user.id);
    if (!error) await fetchProfile(user.id);
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, metadata: {
    username: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) => {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
    return { error: error as Error | null };
  };

  const signInWithOAuth = async (provider: 'google' | 'twitter' | 'discord' | 'facebook') => {
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
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      isLoading,
      isAuthenticated: !!user,
      isAdmin: profile?.role === 'ADMIN' || profile?.role === 'MODERATOR',
      signIn,
      signUp,
      signInWithOAuth,
      signOut: handleSignOut,
      refreshProfile,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
