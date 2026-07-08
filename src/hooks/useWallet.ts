import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type WalletTxn = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  notes: string | null;
  created_at: string;
  tournament_id: string;
};

export function useWallet(userId: string | undefined) {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTxn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setBalance(0);
      setTransactions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      const [{ data: ledger }, { data: txns }] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('pulsepoints_ledger')
          .select('delta')
          .eq('user_id', userId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('tournament_wallet_transactions')
          .select('id, type, amount, currency, status, notes, created_at, tournament_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(25),
      ]);

      if (cancelled) return;
      const sum = ((ledger as { delta: number }[]) ?? []).reduce((acc, row) => acc + row.delta, 0);
      setBalance(sum);
      setTransactions((txns as WalletTxn[]) ?? []);
      setLoading(false);
    };

    run();
    return () => { cancelled = true; };
  }, [userId]);

  return { balance, transactions, loading };
}
