import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/types/database';

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
  // Joined fields
  owner?: {
    username: string;
    avatar_url: string | null;
  };
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
  profile: {
    username: string;
    avatar_url: string | null;
    role: string;
  };
  added_by_profile?: {
    username: string;
  };
}

// Hook to fetch all organizers user can access
export function useOrganizers() {
  const { profile } = useAuth();
  const [organizers, setOrganizers] = useState<OrganizerWithMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizers = useCallback(async () => {
    if (!profile) {
      setOrganizers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Build query - admins see all, others see public + their own + where they're members
    let query = supabase
      .from('organizers')
      .select(`
        *,
        owner:profiles!owner_id(username, avatar_url),
        organizer_members!inner(user_id, role, can_host_tournaments, can_manage_staff, can_edit_branding)
      `)
      .order('verified_status', { ascending: false })
      .order('tournament_count', { ascending: false });

    // For non-admins, only show public organizers or where user is owner/member
    if (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN') {
      query = query.or(`visibility.eq.public,and(owner_id.eq.${profile.id},organizer_members.user_id.eq.${profile.id})`);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setOrganizers([]);
    } else {
      // Transform to include membership info for current user
      const rawData = data || [];
      const transformed: OrganizerWithMembership[] = rawData.map((org: OrganizerWithMembership & { organizer_members?: Array<{user_id: string, role: string, can_host_tournaments: boolean, can_manage_staff: boolean, can_edit_branding: boolean}> }) => {
        const myMembership = org.organizer_members?.find(m => m.user_id === profile!.id);
        const { organizer_members, ...orgWithoutMembers } = org;
        return {
          ...orgWithoutMembers,
          my_role: myMembership?.role as OrganizerWithMembership['my_role'],
          my_permissions: myMembership ? {
            can_host: myMembership.can_host_tournaments,
            can_manage_staff: myMembership.can_manage_staff,
            can_edit_branding: myMembership.can_edit_branding,
          } : undefined,
        };
      });
      setOrganizers(transformed);
    }

    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchOrganizers();
  }, [fetchOrganizers]);

  return { organizers, loading, error, refresh: fetchOrganizers };
}

// Hook to fetch a single organizer with details
export function useOrganizer(slug: string | null) {
  const { profile } = useAuth();
  const [organizer, setOrganizer] = useState<OrganizerWithMembership | null>(null);
  const [members, setMembers] = useState<OrganizerMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setOrganizer(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    const fetchOrganizer = async () => {
      setLoading(true);
      setError(null);

      // Fetch organizer
      const { data: orgData, error: orgError } = await supabase
        .from('organizers')
        .select(`
          *,
          owner:profiles!owner_id(username, avatar_url)
        `)
        .eq('slug', slug)
        .single();

      if (orgError) {
        setError(orgError.message);
        setLoading(false);
        return;
      }

      // Fetch members with profiles
      const { data: membersData, error: membersError } = await supabase
        .from('organizer_members')
        .select(`
          *,
          profile:user_id(username, avatar_url, role),
          added_by_profile:added_by(username)
        `)
        .eq('organizer_id', orgData.id);

      if (membersError) {
        console.error('[useOrganizer] Error fetching members:', membersError);
      }

      // Transform organizer with membership info
      const myMembership = membersData?.find(m => m.user_id === profile?.id) as OrganizerMemberWithProfile | undefined;
      const { owner, ...orgDataClean } = orgData as Organizer & { owner?: {username: string, avatar_url: string | null} };
      const transformed: OrganizerWithMembership = {
        ...orgDataClean,
        owner,
        my_role: myMembership?.role,
        my_permissions: myMembership ? {
          can_host: myMembership.can_host_tournaments,
          can_manage_staff: myMembership.can_manage_staff,
          can_edit_branding: myMembership.can_edit_branding,
        } : undefined,
      };

      setOrganizer(transformed);
      setMembers(membersData || []);
      setLoading(false);
    };

    fetchOrganizer();
  }, [slug, profile?.id]);

  return { organizer, members, loading, error };
}

// Hook for organizer management (create, update, manage members)
export function useOrganizerManagement() {
  const { profile } = useAuth();

  const createOrganizer = async (data: {
    name: string;
    slug: string;
    description?: string;
    visibility?: 'public' | 'private' | 'unlisted';
  }): Promise<{ success: boolean; organizer?: Organizer; error?: string }> => {
    if (!profile) return { success: false, error: 'Not authenticated' };
    
    // Only admins and users with host_tournaments permission can create organizers
    const canCreate = profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN' || 
      await checkHasPermission('host_tournaments');
    
    if (!canCreate) {
      return { success: false, error: 'Permission denied' };
    }

    const { data: organizer, error } = await (supabase
      .from('organizers' as any)
      .insert({
        name: data.name,
        slug: data.slug,
        description: data.description,
        owner_id: profile.id,
        visibility: data.visibility || 'public',
      })
      .select()
      .single() as Promise<{ data: Organizer | null; error: Error | null }>);

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Slug already exists' };
      }
      return { success: false, error: error.message };
    }

    // Auto-add creator as member with full permissions
    await (supabase.from('organizer_members' as any).insert({
      organizer_id: (organizer as Organizer).id,
      user_id: profile.id,
      role: 'co_host',
      can_host_tournaments: true,
      can_manage_staff: true,
      can_edit_branding: true,
      added_by: profile.id,
    }) as Promise<{ error: Error | null }>);

    return { success: true, organizer };
  };

  const updateOrganizer = async (
    organizerId: string,
    data: Partial<Omit<Organizer, 'id' | 'owner_id' | 'created_at'>>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!profile) return { success: false, error: 'Not authenticated' };

    // Check permissions
    const canUpdate = await checkCanManageOrganizer(organizerId);
    if (!canUpdate) {
      return { success: false, error: 'Permission denied' };
    }

    const { error } = await (supabase
      .from('organizers' as any)
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', organizerId) as Promise<{ error: Error | null }>);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const addMember = async (
    organizerId: string,
    userId: string,
    role: 'member' | 'moderator' | 'manager' | 'co_host' = 'member',
    permissions: {
      can_host?: boolean;
      can_manage_staff?: boolean;
      can_edit_branding?: boolean;
    } = {}
  ): Promise<{ success: boolean; error?: string }> => {
    if (!profile) return { success: false, error: 'Not authenticated' };

    const canManage = await checkCanManageOrganizer(organizerId);
    if (!canManage) {
      return { success: false, error: 'Permission denied' };
    }

    const { error } = await (supabase.from('organizer_members' as any).insert({
      organizer_id: organizerId,
      user_id: userId,
      role,
      can_host_tournaments: permissions.can_host || false,
      can_manage_staff: permissions.can_manage_staff || false,
      can_edit_branding: permissions.can_edit_branding || false,
      added_by: profile.id,
    }) as Promise<{ error: Error | null }>);

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'User is already a member' };
      }
      return { success: false, error: error.message };
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

    // Get membership to check organizer_id
    const { data: membership } = await supabase
      .from('organizer_members')
      .select('organizer_id')
      .eq('id', membershipId)
      .single();

    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    const canManage = await checkCanManageOrganizer(membership.organizer_id);
    if (!canManage) {
      return { success: false, error: 'Permission denied' };
    }

    const { error } = await (supabase
      .from('organizer_members' as any)
      .update(updates)
      .eq('id', membershipId) as Promise<{ error: Error | null }>);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const removeMember = async (membershipId: string): Promise<{ success: boolean; error?: string }> => {
    if (!profile) return { success: false, error: 'Not authenticated' };

    // Get membership to check organizer_id
    const { data: membership } = await supabase
      .from('organizer_members')
      .select('organizer_id, user_id')
      .eq('id', membershipId)
      .single() as { data: { organizer_id: string, user_id: string } | null };

    if (!membership) {
      return { success: false, error: 'Membership not found' };
    }

    // Can't remove yourself if you're the owner
    const { data: organizer } = await supabase
      .from('organizers')
      .select('owner_id')
      .eq('id', membership.organizer_id)
      .single() as { data: { owner_id: string } | null };

    if (organizer?.owner_id === membership.user_id) {
      return { success: false, error: 'Cannot remove the owner' };
    }

    const canManage = await checkCanManageOrganizer(membership.organizer_id);
    if (!canManage) {
      return { success: false, error: 'Permission denied' };
    }

    const { error } = await (supabase
      .from('organizer_members' as any)
      .delete()
      .eq('id', membershipId) as Promise<{ error: Error | null }>);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  // Helper functions
  const checkHasPermission = async (permission: string): Promise<boolean> => {
    const { data } = await supabase
      .rpc('has_global_permission', {
        p_user_id: profile!.id,
        p_permission: permission,
      });
    return data || false;
  };

  const checkCanManageOrganizer = async (organizerId: string): Promise<boolean> => {
    if (profile!.role === 'ADMIN' || profile!.role === 'SUPER_ADMIN') return true;

    const { data: organizer } = await supabase
      .from('organizers')
      .select('owner_id')
      .eq('id', organizerId)
      .single();

    if (organizer?.owner_id === profile!.id) return true;

    const { data: membership } = await supabase
      .from('organizer_members')
      .select('can_manage_staff')
      .eq('organizer_id', organizerId)
      .eq('user_id', profile!.id)
      .single() as { data: { can_manage_staff: boolean } | null };

    return membership?.can_manage_staff || false;
  };

  return {
    createOrganizer,
    updateOrganizer,
    addMember,
    updateMember,
    removeMember,
  };
}

// Helper hook to get organizers user can host tournaments for
export function useHostableOrganizers() {
  const { profile } = useAuth();
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setOrganizers([]);
      setLoading(false);
      return;
    }

    const fetchHostable = async () => {
      setLoading(true);

      // Admins see all organizers
      if (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN') {
        const { data } = await supabase
          .from('organizers')
          .select('*, owner:profiles!owner_id(username, avatar_url)')
          .order('name');
        setOrganizers(data || []);
        setLoading(false);
        return;
      }

      // Others see: their own + where they're members with can_host + where they have global permission
      const { data: owned } = await supabase
        .from('organizers')
        .select('*, owner:profiles!owner_id(username, avatar_url)')
        .eq('owner_id', profile.id);

      const { data: memberOrgs } = await supabase
        .from('organizer_members')
        .select('organizer_id, organizers(*)')
        .eq('user_id', profile.id)
        .eq('can_host_tournaments', true);

      const { data: permitted } = await supabase
        .from('global_permissions')
        .select('scope_id')
        .eq('user_id', profile.id)
        .eq('permission', 'host_tournaments')
        .eq('is_active', true)
        .eq('scope_type', 'organizer');

      const organizerIds = new Set([
        ...(owned?.map(o => o.id) || []),
        ...(memberOrgs?.map(m => m.organizer_id) || []),
        ...(permitted?.map(p => p.scope_id).filter(Boolean) || []),
      ]);

      if (organizerIds.size > 0) {
        const { data } = await supabase
          .from('organizers')
          .select('*, owner:profiles!owner_id(username, avatar_url)')
          .in('id', Array.from(organizerIds));
        setOrganizers(data || []);
      } else {
        setOrganizers([]);
      }

      setLoading(false);
    };

    fetchHostable();
  }, [profile]);

  return { organizers, loading };
}
