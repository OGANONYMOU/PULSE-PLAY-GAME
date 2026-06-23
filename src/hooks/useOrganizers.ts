import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface Organizer {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  owner_id: string;
  visibility: 'public' | 'private' | 'unlisted';
  verified_status: 'unverified' | 'pending' | 'verified' | 'featured';
  website_url: string | null;
  twitter_url: string | null;
  discord_url: string | null;
  youtube_url: string | null;
  twitch_url: string | null;
  tournament_count: number;
  follower_count: number;
  total_prize_pool: number;
  created_at: string;
  updated_at: string;
  owner?: { username: string; avatar_url: string | null };
}

export interface OrganizerWithMembership extends Organizer {
  my_role?: 'member' | 'moderator' | 'manager' | 'co_host';
  my_permissions?: {
    can_host: boolean;
    can_manage_staff: boolean;
    can_edit_branding: boolean;
  };
}

export interface OrganizerMemberWithProfile {
  id: string;
  organizer_id: string;
  user_id: string;
  role: 'member' | 'moderator' | 'manager' | 'co_host';
  can_host_tournaments: boolean;
  can_manage_staff: boolean;
  can_edit_branding: boolean;
  added_by: string | null;
  added_at: string;
  profile: { username: string; avatar_url: string | null; role: string };
  added_by_profile?: { username: string };
}

// ── List all organizers the current user can see ──────────────────────────────
export function useOrganizers() {
  const { profile } = useAuth();
  const [organizers, setOrganizers] = useState<OrganizerWithMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizers = useCallback(async () => {
    if (!profile) { setOrganizers([]); setLoading(false); return; }
    setLoading(true); setError(null);

    // Fetch all visible organizers (RLS handles visibility)
    const { data: orgs, error: orgErr } = await (supabase as any)
      .from('organizers')
      .select('*, owner:profiles!owner_id(username, avatar_url)')
      .order('tournament_count', { ascending: false });

    if (orgErr) { setError((orgErr as { message: string }).message); setLoading(false); return; }

    if (!orgs?.length) { setOrganizers([]); setLoading(false); return; }

    // Fetch current user's memberships separately to avoid broken join
    const { data: memberships } = await (supabase as any)
      .from('organizer_members')
      .select('organizer_id, role, can_host_tournaments, can_manage_staff, can_edit_branding')
      .eq('user_id', profile.id);

    const membershipMap = new Map(
      (memberships ?? []).map(m => [m.organizer_id, m])
    );

    const transformed: OrganizerWithMembership[] = orgs.map(org => {
      const m = membershipMap.get(org.id);
      return {
        ...org,
        my_role: m?.role,
        my_permissions: m ? {
          can_host: m.can_host_tournaments,
          can_manage_staff: m.can_manage_staff,
          can_edit_branding: m.can_edit_branding,
        } : undefined,
      };
    });

    setOrganizers(transformed);
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchOrganizers(); }, [fetchOrganizers]);

  return { organizers, loading, error, refresh: fetchOrganizers };
}

// ── Single organizer with members ─────────────────────────────────────────────
export function useOrganizer(slug: string | null) {
  const { profile } = useAuth();
  const [organizer, setOrganizer] = useState<OrganizerWithMembership | null>(null);
  const [members, setMembers] = useState<OrganizerMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setOrganizer(null); setMembers([]); setLoading(false); return; }

    const fetchOrganizer = async () => {
      setLoading(true); setError(null);

      const { data: orgData, error: orgError } = await (supabase as any)
        .from('organizers')
        .select('*, owner:profiles!owner_id(username, avatar_url)')
        .eq('slug', slug)
        .single();

      if (orgError) { setError((orgError as { message: string }).message); setLoading(false); return; }

      const { data: membersData } = await (supabase as any)
        .from('organizer_members')
        .select('*, profile:user_id(username, avatar_url, role), added_by_profile:added_by(username)')
        .eq('organizer_id', (orgData as Organizer).id);

      const rows = (membersData ?? []) as OrganizerMemberWithProfile[];
      const myMembership = rows.find(m => m.user_id === profile?.id);
      setOrganizer({
        ...(orgData as Organizer),
        my_role: myMembership?.role,
        my_permissions: myMembership ? {
          can_host: myMembership.can_host_tournaments,
          can_manage_staff: myMembership.can_manage_staff,
          can_edit_branding: myMembership.can_edit_branding,
        } : undefined,
      });
      setMembers(rows);
      setLoading(false);
    };

    fetchOrganizer();
  }, [slug, profile?.id]);

  return { organizer, members, loading, error };
}

// ── Organizer CRUD ────────────────────────────────────────────────────────────
export function useOrganizerManagement() {
  const { profile } = useAuth();

  const createOrganizer = async (data: {
    name: string;
    slug: string;
    description?: string;
    visibility?: 'public' | 'private' | 'unlisted';
  }): Promise<{ success: boolean; organizer?: Organizer; error?: string }> => {
    if (!profile) return { success: false, error: 'Not authenticated' };

    const { data: organizer, error } = await (supabase as any)
      .from('organizers')
      .insert({
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        owner_id: profile.id,
        visibility: data.visibility || 'public',
      })
      .select()
      .single();

    if (error) {
      if ((error as { code: string }).code === '23505') return { success: false, error: 'That slug is already taken — try a different one.' };
      return { success: false, error: (error as { message: string }).message };
    }

    // Auto-add creator as co_host member with full permissions
    await (supabase as any).from('organizer_members').insert({
      organizer_id: (organizer as Organizer).id,
      user_id: profile.id,
      role: 'co_host',
      can_host_tournaments: true,
      can_manage_staff: true,
      can_edit_branding: true,
      added_by: profile.id,
    });

    return { success: true, organizer };
  };

  const updateOrganizer = async (
    organizerId: string,
    data: Partial<Omit<Organizer, 'id' | 'owner_id' | 'created_at'>>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!profile) return { success: false, error: 'Not authenticated' };

    const { error } = await (supabase as any)
      .from('organizers')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', organizerId);

    return error ? { success: false, error: (error as { message: string }).message } : { success: true };
  };

  const addMember = async (
    organizerId: string,
    userId: string,
    role: 'member' | 'moderator' | 'manager' | 'co_host' = 'member',
    permissions: { can_host?: boolean; can_manage_staff?: boolean; can_edit_branding?: boolean } = {}
  ): Promise<{ success: boolean; error?: string }> => {
    if (!profile) return { success: false, error: 'Not authenticated' };

    const { error } = await (supabase as any).from('organizer_members').insert({
      organizer_id: organizerId,
      user_id: userId,
      role,
      can_host_tournaments: permissions.can_host ?? false,
      can_manage_staff: permissions.can_manage_staff ?? false,
      can_edit_branding: permissions.can_edit_branding ?? false,
      added_by: profile.id,
    });

    if (error) {
      if ((error as { code: string }).code === '23505') return { success: false, error: 'User is already a member' };
      return { success: false, error: (error as { message: string }).message };
    }
    return { success: true };
  };

  const updateMember = async (
    membershipId: string,
    updates: {
      role?: 'member' | 'moderator' | 'manager' | 'co_host';
      can_host_tournaments?: boolean;
      can_manage_staff?: boolean;
      can_edit_branding?: boolean;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    if (!profile) return { success: false, error: 'Not authenticated' };
    const { error } = await (supabase as any).from('organizer_members').update(updates).eq('id', membershipId);
    return error ? { success: false, error: (error as { message: string }).message } : { success: true };
  };

  const removeMember = async (membershipId: string): Promise<{ success: boolean; error?: string }> => {
    if (!profile) return { success: false, error: 'Not authenticated' };

    const { data: membership } = await (supabase as any)
      .from('organizer_members')
      .select('organizer_id, user_id')
      .eq('id', membershipId)
      .single();

    if (!membership) return { success: false, error: 'Membership not found' };

    const { data: org } = await (supabase as any).from('organizers').select('owner_id').eq('id', (membership as { organizer_id: string; user_id: string }).organizer_id).single();
    if ((org as { owner_id: string } | null)?.owner_id === (membership as { user_id: string }).user_id) return { success: false, error: 'Cannot remove the owner' };

    const { error } = await (supabase as any).from('organizer_members').delete().eq('id', membershipId);
    return error ? { success: false, error: (error as { message: string }).message } : { success: true };
  };

  return { createOrganizer, updateOrganizer, addMember, updateMember, removeMember };
}

// ── Organizers the current user can host tournaments for ──────────────────────
export function useHostableOrganizers() {
  const { profile } = useAuth();
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHostable = useCallback(async () => {
    if (!profile) { setOrganizers([]); setLoading(false); return; }
    setLoading(true);

    // Admins see all
    if (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN') {
      const { data } = await (supabase as any)
        .from('organizers')
        .select('*, owner:profiles!owner_id(username, avatar_url)')
        .order('name');
      setOrganizers((data as Organizer[]) ?? []);
      setLoading(false);
      return;
    }

    // Owned organizers
    const { data: owned } = await (supabase as any)
      .from('organizers')
      .select('*, owner:profiles!owner_id(username, avatar_url)')
      .eq('owner_id', profile.id);

    // Organizer memberships with hosting rights
    const { data: memberRows } = await (supabase as any)
      .from('organizer_members')
      .select('organizer_id')
      .eq('user_id', profile.id)
      .eq('can_host_tournaments', true);

    const memberOrgIds = ((memberRows ?? []) as Array<{ organizer_id: string }>).map(r => r.organizer_id);

    let memberOrgs: Organizer[] = [];
    if (memberOrgIds.length > 0) {
      const { data } = await (supabase as any)
        .from('organizers')
        .select('*, owner:profiles!owner_id(username, avatar_url)')
        .in('id', memberOrgIds);
      memberOrgs = (data as Organizer[]) ?? [];
    }

    // Merge, deduplicate
    const seen = new Set<string>();
    const all: Organizer[] = [];
    for (const org of [...((owned as Organizer[]) ?? []), ...memberOrgs]) {
      if (!seen.has(org.id)) { seen.add(org.id); all.push(org); }
    }

    setOrganizers(all);
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchHostable(); }, [fetchHostable]);

  return { organizers, loading, refresh: fetchHostable };
}
