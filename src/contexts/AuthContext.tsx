import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) {
        console.error('[Auth] profile fetch error:', error.message, '| code:', error.code);
        return null;
      }
      const p = data as Profile;
      setProfile(p);
      return p;
    } catch (err) {
      console.error('[Auth] profile fetch threw:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (err) {
        console.error('[Auth] init error:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        if (event === 'SIGNED_IN') {
          await new Promise((r) => setTimeout(r, 1000));
        }
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      if (mounted) setIsLoading(false);
    });

    const channel = supabase
      .channel('auth-profile-rt')
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
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []); // eslint-disable-line

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id);
  };

  const updateProfile = async (data: Partial<Profile>): Promise<{ error: Error | null }> => {
    if (!user?.id) return { error: new Error('Not authenticated') };
    const { error } = await supabase.from('profiles').update(data as never).eq('id', user.id);
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
      user, profile, isLoading,
      isAuthenticated: !!user,
      isAdmin: profile?.role === 'ADMIN' || profile?.role === 'MODERATOR',
      signIn, signUp, signInWithOAuth,
      signOut: handleSignOut,
      refreshProfile, updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}