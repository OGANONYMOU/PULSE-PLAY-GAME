import { Link } from 'react-router-dom';
import { Wallet as WalletIcon, User, ArrowUpRight, ArrowDownRight, ShieldCheck, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { formatDistanceToNow } from 'date-fns';

// 1 PulsePoint = ₦1 — update when a real conversion rate is set
export const PP_TO_NAIRA_RATE = 1;
const MIN_REDEEM_PP = 500;

export function Wallet(): React.ReactElement {
  const { user, isLoading: authLoading } = useAuth();
  const { balance, transactions, loading } = useWallet(user?.id);

  if (authLoading) {
    return (
      <div className="min-h-screen pt-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-4">
          <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-56 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-6">
        <div className="text-center p-10 rounded-2xl bg-white/5 border border-white/10 max-w-md w-full">
          <User className="w-16 h-16 mx-auto text-cyan-400 mb-4" />
          <h2 className="font-orbitron text-2xl font-bold text-white mb-2">Sign In Required</h2>
          <p className="text-white/50 text-sm mb-6">Please sign in to view your wallet.</p>
          <Button asChild className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white w-full"><Link to="/signin">Sign In</Link></Button>
        </div>
      </div>
    );
  }

  const nairaValue = balance * PP_TO_NAIRA_RATE;
  const canRedeem = balance >= MIN_REDEEM_PP;

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Header / balance */}
        <div className="gaming-card p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
              <WalletIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-orbitron text-xl sm:text-2xl font-bold text-white">Wallet</h1>
          </div>
          <p className="text-white/40 text-xs uppercase tracking-wider mb-1">PulsePoints Balance</p>
          <p className="font-orbitron text-4xl sm:text-5xl font-black gradient-text mb-1">
            {loading ? '—' : balance.toLocaleString()} <span className="text-lg font-bold text-white/50">PP</span>
          </p>
          <p className="text-white/40 text-sm">≈ ₦{nairaValue.toLocaleString()}</p>
        </div>

        {/* Redeem */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 sm:p-6 mb-6">
          <h2 className="font-orbitron font-bold text-sm text-white mb-3 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-cyan-400" /> Redeem
          </h2>
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 w-fit">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">Payouts powered by Paystack</span>
          </div>
          <div className="space-y-1.5 text-xs text-white/50 mb-4">
            <p>Conversion rate: 1 PP = ₦{PP_TO_NAIRA_RATE}</p>
            <p>Minimum redemption: {MIN_REDEEM_PP.toLocaleString()} PP</p>
          </div>
          <Button disabled className="w-full h-11 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold disabled:opacity-50">
            Redeem to Paystack
          </Button>
          <p className="text-[11px] text-white/35 mt-2 flex items-center gap-1.5">
            <Info className="w-3 h-3 flex-shrink-0" />
            {canRedeem
              ? 'Redemption opens once Paystack payout integration is live.'
              : `You need at least ${MIN_REDEEM_PP.toLocaleString()} PP to redeem.`}
          </p>
        </div>

        {/* Transaction history */}
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-white/10">
            <h2 className="font-orbitron font-bold text-sm text-white/80">Transaction History</h2>
          </div>
          <div className="p-5 sm:p-6">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-10">
                <WalletIcon className="w-10 h-10 mx-auto text-white/15 mb-3" />
                <p className="text-white/40 text-sm">No transactions yet — your entry fees and prize payouts will show up here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((txn) => {
                  const isCredit = txn.amount >= 0;
                  return (
                    <div key={txn.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/8">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isCredit ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
                        {isCredit
                          ? <ArrowDownRight className="w-4 h-4 text-green-400" />
                          : <ArrowUpRight className="w-4 h-4 text-red-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white capitalize truncate">{txn.type.replace(/_/g, ' ')}</p>
                        <p className="text-[11px] text-white/40">{formatDistanceToNow(new Date(txn.created_at), { addSuffix: true })} · {txn.status}</p>
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
                        {isCredit ? '+' : ''}{txn.amount.toLocaleString()} PP
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
