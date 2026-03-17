import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  ref_type: string | null;
  ref_id: string | null;
  is_read: boolean;
  created_at: string;
};

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (!user) { setNotifications([]); setUnreadCount(0); return; }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    const rows = (data as Notification[]) ?? [];
    setNotifications(rows);
    setUnreadCount(rows.filter(n => !n.is_read).length);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase.channel(`notifs_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, user]);

  const markRead = async (id?: string) => {
    if (!user) return;
    if (id) {
      await supabase.from('notifications').update({ is_read: true } as never).eq('id', id);
    } else {
      await supabase.from('notifications').update({ is_read: true } as never)
        .eq('user_id', user.id).eq('is_read', false);
    }
    load();
  };

  return { notifications, unreadCount, markRead, refetch: load };
}
