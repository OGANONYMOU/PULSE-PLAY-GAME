import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Tournament = Database['public']['Tables']['tournaments']['Row'];

export type TournamentWithGame = Tournament & {
  games: {
    name: string;
    icon: string;
  } | null;
};

export function useTournaments() {
  const [tournaments, setTournaments] = useState<TournamentWithGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTournaments = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          games (
            name,
            icon
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setTournaments((data as TournamentWithGame[]) || []);
      }
      setIsLoading(false);
    };

    fetchTournaments();
  }, []);

  return { tournaments, isLoading, error };
}
