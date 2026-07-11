// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Real-Time System - Supabase Subscriptions
// Live updates for incidents, moderation, tournaments, matches
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type SubscriptionEvent = 
  | 'incident_created'
  | 'incident_updated'
  | 'moderation_case_created'
  | 'moderation_case_updated'
  | 'dispute_created'
  | 'dispute_updated'
  | 'fraud_flag_created'
  | 'tournament_match_completed'
  | 'audit_log_created';

export interface SubscriptionConfig {
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  callback: (payload: { new: Record<string, unknown>; old: Record<string, unknown> | null }) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

class SubscriptionManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private static instance: SubscriptionManager;
  
  static getInstance(): SubscriptionManager {
    if (!SubscriptionManager.instance) {
      SubscriptionManager.instance = new SubscriptionManager();
    }
    return SubscriptionManager.instance;
  }
  
  /**
   * Subscribe to real-time updates on a table
   */
  subscribe(config: SubscriptionConfig): string {
    const channelId = `${config.table}_${config.event}_${Date.now()}`;
    
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: config.event,
          schema: 'public',
          table: config.table,
          filter: config.filter,
        },
        (payload) => {
          config.callback({
            new: payload.new as Record<string, unknown>,
            old: payload.old as Record<string, unknown> | null,
          });
        }
      )
      .subscribe();
    
    this.channels.set(channelId, channel);
    return channelId;
  }
  
  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelId);
    }
  }
  
  /**
   * Unsubscribe all channels
   */
  unsubscribeAll(): void {
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
  }
  
  /**
   * Get active channel count
   */
  getActiveChannelCount(): number {
    return this.channels.size;
  }
}

export const subscriptionManager = SubscriptionManager.getInstance();

// ═══════════════════════════════════════════════════════════════════════════════
// PRE-DEFINED SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to new incidents
 */
export function subscribeToIncidents(
  callback: (incident: Record<string, unknown>) => void
): string {
  return subscriptionManager.subscribe({
    table: 'incidents',
    event: 'INSERT',
    callback: (payload) => {
      callback(payload.new);
    },
  });
}

/**
 * Subscribe to incident updates
 */
export function subscribeToIncidentUpdates(
  incident_id: string,
  callback: (incident: Record<string, unknown>) => void
): string {
  return subscriptionManager.subscribe({
    table: 'incidents',
    event: 'UPDATE',
    filter: `id=eq.${incident_id}`,
    callback: (payload) => {
      callback(payload.new);
    },
  });
}

/**
 * Subscribe to new moderation cases
 */
export function subscribeToModerationCases(
  callback: (case_data: Record<string, unknown>) => void
): string {
  return subscriptionManager.subscribe({
    table: 'moderation_cases',
    event: 'INSERT',
    callback: (payload) => {
      callback(payload.new);
    },
  });
}

/**
 * Subscribe to moderation case updates
 */
export function subscribeToCaseUpdates(
  case_id: string,
  callback: (case_data: Record<string, unknown>) => void
): string {
  return subscriptionManager.subscribe({
    table: 'moderation_cases',
    event: 'UPDATE',
    filter: `id=eq.${case_id}`,
    callback: (payload) => {
      callback(payload.new);
    },
  });
}

/**
 * Subscribe to new disputes
 */
export function subscribeToDisputes(
  tournament_id: string | null,
  callback: (dispute: Record<string, unknown>) => void
): string {
  return subscriptionManager.subscribe({
    table: 'disputes',
    event: 'INSERT',
    filter: tournament_id ? `tournament_id=eq.${tournament_id}` : undefined,
    callback: (payload) => {
      callback(payload.new);
    },
  });
}

/**
 * Subscribe to fraud flags
 */
export function subscribeToFraudFlags(
  tournament_id: string | null,
  callback: (flag: Record<string, unknown>) => void
): string {
  return subscriptionManager.subscribe({
    table: 'fraud_flags',
    event: '*',
    filter: tournament_id ? `tournament_id=eq.${tournament_id}` : undefined,
    callback: (payload) => {
      callback(payload.new);
    },
  });
}

/**
 * Subscribe to tournament match completions
 */
export function subscribeToMatchCompletions(
  tournament_id: string,
  callback: (match: Record<string, unknown>) => void
): string {
  return subscriptionManager.subscribe({
    table: 'matches',
    event: 'UPDATE',
    filter: `tournament_id=eq.${tournament_id}`,
    callback: (payload) => {
      if (payload.new.status === 'completed') {
        callback(payload.new);
      }
    },
  });
}

/**
 * Subscribe to audit logs
 */
export function subscribeToAuditLogs(
  callback: (log: Record<string, unknown>) => void
): string {
  return subscriptionManager.subscribe({
    table: 'audit_logs',
    event: 'INSERT',
    callback: (payload) => {
      callback(payload.new);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// REAL-TIME HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';

/**
 * React hook for real-time moderation cases
 */
export function useRealtimeModerationCases() {
  const [cases, setCases] = useState<Record<string, unknown>[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    // Initial fetch
    supabase
      .from('moderation_cases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setCases(data);
      });
    
    // Subscribe to new cases
    const channelId = subscribeToModerationCases((newCase) => {
      setCases((prev) => [newCase, ...prev]);
    });
    
    setIsConnected(true);
    
    return () => {
      subscriptionManager.unsubscribe(channelId);
      setIsConnected(false);
    };
  }, []);
  
  return { cases, isConnected };
}

/**
 * React hook for real-time incidents
 */
export function useRealtimeIncidents(severity?: string) {
  const [incidents, setIncidents] = useState<Record<string, unknown>[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    // Initial fetch
    let query = supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (severity) {
      query = query.eq('severity', severity);
    }
    
    query.limit(50).then(({ data }) => {
      if (data) setIncidents(data);
    });
    
    // Subscribe to new incidents
    const channelId = subscribeToIncidents((newIncident) => {
      if (!severity || newIncident.severity === severity) {
        setIncidents((prev) => [newIncident, ...prev]);
      }
    });
    
    setIsConnected(true);
    
    return () => {
      subscriptionManager.unsubscribe(channelId);
      setIsConnected(false);
    };
  }, [severity]);
  
  return { incidents, isConnected };
}

/**
 * React hook for real-time tournament updates
 */
export function useRealtimeTournament(tournament_id: string) {
  const [matches, setMatches] = useState<Record<string, unknown>[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    // Initial fetch
    supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournament_id)
      .order('round', { ascending: true })
      .order('match_number', { ascending: true })
      .then(({ data }) => {
        if (data) setMatches(data);
      });
    
    // Subscribe to match updates
    const channelId = subscribeToMatchCompletions(tournament_id, (updatedMatch) => {
      setMatches((prev) =>
        prev.map((m) => (m.id === updatedMatch.id ? updatedMatch : m))
      );
    });
    
    setIsConnected(true);
    
    return () => {
      subscriptionManager.unsubscribe(channelId);
      setIsConnected(false);
    };
  }, [tournament_id]);
  
  return { matches, isConnected };
}
