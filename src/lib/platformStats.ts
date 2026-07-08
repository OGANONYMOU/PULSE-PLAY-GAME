import { supabase } from '@/lib/supabase';

export type PlatformStats = {
  activeGamers: number;
  tournamentsHosted: number;
  totalPrizePool: number;
  partnerGames: number;
};

export async function getPlatformStats(): Promise<PlatformStats> {
  const [{ count: activeGamers }, { count: tournamentsHosted }, { count: partnerGames }, { data: prizeRows }] =
    await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('profiles').select('id', { count: 'exact', head: true }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('tournaments').select('id', { count: 'exact', head: true }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('games').select('id', { count: 'exact', head: true }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('tournaments').select('prize_amount'),
    ]);

  const totalPrizePool = ((prizeRows as { prize_amount: number | null }[]) ?? [])
    .reduce((acc, row) => acc + (row.prize_amount ?? 0), 0);

  return {
    activeGamers: activeGamers ?? 0,
    tournamentsHosted: tournamentsHosted ?? 0,
    totalPrizePool,
    partnerGames: partnerGames ?? 0,
  };
}
