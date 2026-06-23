import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type GlobalPermission = 
  | 'host_tournaments' 
  | 'moderate_content' 
  | 'review_disputes' 
  | 'manage_users' 
  | 'access_audit_logs' 
  | 'featured_host';

export type PermissionScope = 'global' | 'organizer' | 'tournament';

export interface GlobalPermissionRow {
  id: string;
  user_id: string;
  granted_by: string;
  permission: GlobalPermission;
  scope_type: PermissionScope;
  scope_id: string | null;
  is_active: boolean;
  granted_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  notes: string | null;
}

export interface OrganizerMember {
  id: string;
  organizer_id: string;
  user_id: string;
  role: 'member' | 'moderator' | 'manager' | 'co_host';
  can_host_tournaments: boolean;
  can_manage_staff: boolean;
  can_edit_branding: boolean;
  added_by: string | null;
  added_at: string;
}

export interface TournamentStaffRole {
  role: 'host' | 'manager' | 'bracket_manager' | 'reporter' | 'referee' | 'streamer' | 'observer' | null;
  isAdmin: boolean;
}

export function usePermissions() {
  const { profile } = useAuth();
  const [permissions, setPermissions] = useState<GlobalPermissionRow[]>([]);
  const [myOrganizerMemberships, setMyOrganizerMemberships] = useState<OrganizerMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!profile) {
      setPermissions([]);
      setMyOrganizerMemberships([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Fetch global permissions
    const { data: permsData, error: permsError } = await (supabase as any)
      .from('global_permissions')
      .select('*')
      .eq('user_id', profile.id)
      .eq('is_active', true);

    if (permsError) {
      console.error('[usePermissions] Error fetching permissions:', permsError);
    } else {
      setPermissions((permsData as GlobalPermissionRow[]) || []);
    }

    // Fetch organizer memberships
    const { data: membersData, error: membersError } = await (supabase as any)
      .from('organizer_members')
      .select('*')
      .eq('user_id', profile.id);

    if (membersError) {
      console.error('[usePermissions] Error fetching memberships:', membersError);
    } else {
      setMyOrganizerMemberships((membersData as OrganizerMember[]) || []);
    }

    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Check if user has a specific global permission
  const hasPermission = useCallback((permission: GlobalPermission, scopeType?: PermissionScope, scopeId?: string): boolean => {
    if (!profile) return false;
    
    // Admins and super admins have all permissions
    if (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN') return true;

    return permissions.some(p => 
      p.permission === permission && 
      p.is_active &&
      (scopeType === undefined || p.scope_type === scopeType || p.scope_type === 'global') &&
      (scopeId === undefined || p.scope_id === scopeId || p.scope_id === null)
    );
  }, [permissions, profile]);

  // Check if user can host tournaments for a specific organizer
  const canHostForOrganizer = useCallback((organizerId: string): boolean => {
    if (!profile) return false;
    
    // Admins can always host
    if (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN') return true;

    // Check organizer membership with host permission
    const membership = myOrganizerMemberships.find(m => m.organizer_id === organizerId);
    if (membership?.can_host_tournaments) return true;

    // Check global host_tournaments permission scoped to this organizer
    return permissions.some(p => 
      p.permission === 'host_tournaments' && 
      p.is_active &&
      (p.scope_type === 'organizer' && p.scope_id === organizerId)
    );
  }, [myOrganizerMemberships, permissions, profile]);

  // Get list of organizers user can host for
  const getHostableOrganizers = useCallback((): string[] => {
    if (!profile) return [];
    
    // Admins can host for any organizer (they'll see all in UI)
    if (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN') return ['*'];

    const organizerIds = new Set<string>();
    
    // From memberships
    myOrganizerMemberships
      .filter(m => m.can_host_tournaments)
      .forEach(m => organizerIds.add(m.organizer_id));
    
    // From global permissions
    permissions
      .filter(p => p.permission === 'host_tournaments' && p.is_active && p.scope_type === 'organizer' && p.scope_id)
      .forEach(p => organizerIds.add(p.scope_id!));
    
    return Array.from(organizerIds);
  }, [myOrganizerMemberships, permissions, profile]);

  // Check if user is moderator (has moderate_content permission)
  const isModerator = useCallback((): boolean => {
    if (!profile) return false;
    return profile.role === 'MODERATOR' || profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN' || hasPermission('moderate_content');
  }, [hasPermission, profile]);

  return {
    permissions,
    myOrganizerMemberships,
    loading,
    hasPermission,
    canHostForOrganizer,
    getHostableOrganizers,
    isModerator,
    refresh: fetchPermissions,
  };
}

// Hook to check tournament-specific role
export function useTournamentRole(tournamentId: string | null) {
  const { profile } = useAuth();
  const [role, setRole] = useState<TournamentStaffRole>({ role: null, isAdmin: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId || !profile) {
      setRole({ role: null, isAdmin: false });
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      setLoading(true);
      
      // Check if admin
      if (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN') {
        setRole({ role: 'host', isAdmin: true });
        setLoading(false);
        return;
      }

      // Use the database function to get role
      const { data, error } = await (supabase as any)
        .rpc('get_tournament_role', {
          p_user_id: profile.id,
          p_tournament_id: tournamentId,
        });

      if (error) {
        console.error('[useTournamentRole] Error:', error);
        setRole({ role: null, isAdmin: false });
      } else {
        setRole({
          role: data as TournamentStaffRole['role'],
          isAdmin: false, // admins already returned early above
        });
      }
      
      setLoading(false);
    };

    fetchRole();
  }, [tournamentId, profile]);

  return { role, loading };
}

// Hook to fetch user's permissions granted by admin
export function useUserPermissions(userId: string | null) {
  const [permissions, setPermissions] = useState<GlobalPermissionRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setPermissions([]);
      return;
    }

    const fetchUserPermissions = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('global_permissions')
        .select('*')
        .eq('user_id', userId)
        .order('granted_at', { ascending: false });

      if (error) {
        console.error('[useUserPermissions] Error:', error);
      } else {
        setPermissions((data as GlobalPermissionRow[]) || []);
      }
      setLoading(false);
    };

    fetchUserPermissions();
  }, [userId]);

  return { permissions, loading };
}

// Hook for admin to grant/revoke permissions
export function usePermissionManagement() {
  const { profile } = useAuth();

  const grantPermission = async (
    userId: string,
    permission: GlobalPermission,
    scopeType: PermissionScope = 'global',
    scopeId: string | null = null,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN')) {
      return { success: false, error: 'Unauthorized' };
    }

    const { error } = await (supabase as any).from('global_permissions').insert({
      user_id: userId,
      granted_by: profile.id,
      permission,
      scope_type: scopeType,
      scope_id: scopeId,
      notes,
      is_active: true,
    });

    if (error) {
      // Handle unique constraint violation (permission already exists)
      if (error.code === '23505') {
        return { success: false, error: 'Permission already granted' };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const revokePermission = async (
    permissionId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN')) {
      return { success: false, error: 'Unauthorized' };
    }

    const { error } = await (supabase as any)
      .from('global_permissions')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: profile.id,
        notes: reason,
      })
      .eq('id', permissionId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const updateOrganizerMemberPermission = async (
    membershipId: string,
    canHost: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN')) {
      return { success: false, error: 'Unauthorized' };
    }

    const { error } = await (supabase as any)
      .from('organizer_members')
      .update({ can_host_tournaments: canHost })
      .eq('id', membershipId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  return {
    grantPermission,
    revokePermission,
    updateOrganizerMemberPermission,
    isAdmin: profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN',
  };
}
