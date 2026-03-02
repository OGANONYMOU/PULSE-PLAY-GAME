import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Game = Database['public']['Tables']['games']['Row'];

export function useGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGames = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('featured', { ascending: false })
        .order('tournament_count', { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setGames(data || []);
      }
      setIsLoading(false);
    };

    fetchGames();
  }, []);

  return { games, isLoading, error };
}
