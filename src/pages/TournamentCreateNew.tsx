import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Shield, ChevronRight, ArrowLeft, Building2,
  Loader2, Lock, Globe, Info, Sparkles, CheckCircle,
  Users, Zap, Gamepad2, Swords, Medal, Clock,
  Calendar, DollarSign, MapPin, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useHostableOrganizers } from '@/hooks/useOrganizers';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { writeAuditLog } from '@/lib/auditLog';

type Game = { id: string; name: string; icon: string; logo_url: string | null; category: string };
type TournamentType = 'esports' | 'football' | 'league';
type BracketType = 'single_elimination' | 'double_elimination' | 'swiss' | 'round_robin' | 'ladder';
type FootballType = 'league' | 'group_stage' | 'group_knockout' | 'knockout';

interface TournamentForm {
  // Step 1: Organizer
  organizer_id: string;
  
  // Step 2: Game & Type
  game_id: string;
  tournament_family: TournamentType;
  tournament_type: BracketType | FootballType;
  
  // Step 3: Basic Info
  name: string;
  description: string;
  format: 'best_of_1' | 'best_of_3' | 'best_of_5';
  max_players: number;
  team_size: number;
  
  // Step 4: Schedule
  date: string;
  registration_closes: string;
  check_in_open: string;
  check_in_close: string;
  timezone: string;
  
  // Step 5: Prizes & Entry
  entry_fee: number;
  prize_amount: number;
  currency: string;
  
  // Step 6: Rules & Settings
  rules: string;
  is_public: boolean;
  requires_check_in: boolean;
  
  // Football-specific
  season_name?: string;
  season_year?: number;
  rounds_count?: number;
  home_and_away?: boolean;
}

const EFOOTBALL_EASY_MODE = {
  rules: `🎮 eFootball Tournament Rules

• Match Format: Best of 1 (single match per round)
• Time Limit: Standard match settings
• Score Submission: Both players submit scoreline with screenshot proof
• Opponent must confirm result within 24 hours
• Disputes resolved by admin within 48 hours
• No custom formations from opponent — use default settings
• Lag/disconnect: Reconnect within 5 minutes or forfeit
• Fair play expected — toxicity = GamerCred penalty`,
  format: 'best_of_1' as const,
  max_players: 32,
  duration: '2h',
};

const STEPS = [
  { id: 'organizer', label: 'Organizer', icon: Building2 },
  { id: 'game', label: 'Game & Type', icon: Gamepad2 },
  { id: 'details', label: 'Details', icon: Info },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'prize', label: 'Prize', icon: DollarSign },
  { id: 'review', label: 'Review', icon: CheckCircle },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8 overflow-x-auto py-2">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = index === currentStep;
        const isComplete = index < currentStep;
        
        return (
          <div key={step.id} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <div className={`flex flex-col items-center gap-1 ${index > 0 ? 'ml-1' : ''}`}>
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all ${
                isComplete ? 'bg-green-500/20 border border-green-500/40 text-green-400' :
                isActive ? 'bg-gradient-to-br from-cyan-500 to-purple-600 text-white shadow-lg shadow-cyan-500/20' :
                'bg-white/5 border border-white/10 text-white/30'
              }`}>
                {isComplete ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : <Icon className="w-4 h-4 sm:w-5 sm:h-5" />}
              </div>
              <span className={`text-[10px] uppercase tracking-wider hidden sm:block ${
                isActive ? 'text-cyan-400' : 'text-white/30'
              }`}>
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`w-4 sm:w-8 h-0.5 rounded-full ${
                isComplete ? 'bg-green-500/40' : 'bg-white/10'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FieldLabel({ label, required, hint }: { label: string; required?: boolean; hint?: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <label className="text-xs text-white/55 uppercase tracking-wider font-medium">{label}</label>
      {required && <span className="text-red-400 text-xs">*</span>}
      {hint && (
        <div className="group relative">
          <Info className="w-3 h-3 text-white/25 cursor-help" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#0d0d1e] border border-white/10 rounded-lg text-[10px] text-white/55 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl">
            {hint}
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = 'bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50 h-10 text-sm rounded-xl';

// ── Step 1: Organizer Selection ──────────────────────────────────────────────
function StepOrganizer({ 
  form, 
  setForm, 
  organizers, 
  loading 
}: { 
  form: TournamentForm; 
  setForm: React.Dispatch<React.SetStateAction<TournamentForm>>;
  organizers: Array<{ id: string; name: string; avatar_url: string | null; tournament_count: number }>;
  loading: boolean;
}) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (organizers.length === 0) {
    return (
      <div className="text-center py-8">
        <Building2 className="w-12 h-12 mx-auto text-white/20 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No organizers available</h3>
        <p className="text-white/50 text-sm max-w-sm mx-auto mb-4">
          {isAdmin 
            ? "Create an organizer first to host tournaments under a branded identity."
            : "You need to be added as a member to an organizer with hosting permissions."
          }
        </p>
        {isAdmin && (
          <Button asChild className="bg-gradient-to-r from-cyan-500 to-purple-600">
            <Link to="/admin/organizers">Create Organizer</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-orbitron font-bold text-lg text-white">Select Organizer</h2>
      <p className="text-sm text-white/40">Choose which organizer will host this tournament</p>
      
      <div className="grid grid-cols-1 gap-3">
        {organizers.map((org) => (
          <button
            key={org.id}
            onClick={() => setForm(prev => ({ ...prev, organizer_id: org.id }))}
            className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
              form.organizer_id === org.id
                ? 'border-cyan-500/50 bg-cyan-500/10'
                : 'border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5'
            }`}
          >
            <Avatar className="w-12 h-12 rounded-xl">
              <AvatarImage src={org.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl">
                <Building2 className="w-5 h-5 text-white" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-white">{org.name}</p>
              <p className="text-xs text-white/40">{org.tournament_count} tournaments hosted</p>
            </div>
            {form.organizer_id === org.id && (
              <CheckCircle className="w-5 h-5 text-cyan-400" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Game & Tournament Type ─────────────────────────────────────────
function StepGame({ form, setForm, games }: { form: TournamentForm; setForm: React.Dispatch<React.SetStateAction<TournamentForm>>; games: Game[] }) {
  const selectedGame = games.find(g => g.id === form.game_id);
  const isEFootball = selectedGame?.name.toLowerCase().includes('efootball');
  const isFootball = selectedGame?.category === 'sports' || isEFootball;

  // Auto-set tournament family based on game
  useEffect(() => {
    if (isFootball && form.tournament_family !== 'football') {
      setForm(prev => ({ ...prev, tournament_family: 'football', tournament_type: 'league' }));
    } else if (!isFootball && form.tournament_family === 'football') {
      setForm(prev => ({ ...prev, tournament_family: 'esports', tournament_type: 'single_elimination' }));
    }
  }, [isFootball, setForm]);

  return (
    <div className="space-y-6">
      {/* Game Selection */}
      <div>
        <FieldLabel label="Select Game" required />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {games.map(g => (
            <button
              key={g.id}
              onClick={() => setForm(prev => ({ ...prev, game_id: g.id }))}
              className={`relative p-4 rounded-xl border text-left transition-all ${
                form.game_id === g.id
                  ? 'border-cyan-500/50 bg-cyan-500/10'
                  : 'border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5'
              }`}
            >
              {form.game_id === g.id && <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-cyan-400" />}
              <div className="w-10 h-10 rounded-xl overflow-hidden mb-3 bg-white/8">
                {g.logo_url
                  ? <img src={g.logo_url} alt={g.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-2xl">{g.icon}</div>}
              </div>
              <p className="font-semibold text-sm text-white truncate">{g.name}</p>
              <Badge variant="outline" className="mt-1 text-[10px]">{g.category}</Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Tournament Family */}
      {form.game_id && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <FieldLabel label="Tournament Format Family" required />
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setForm(prev => ({ 
                ...prev, 
                tournament_family: 'esports', 
                tournament_type: 'single_elimination' 
              }))}
              className={`p-4 rounded-xl border text-left transition-all ${
                form.tournament_family === 'esports'
                  ? 'border-cyan-500/50 bg-cyan-500/10'
                  : 'border-white/10 bg-white/3 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Swords className={`w-5 h-5 ${form.tournament_family === 'esports' ? 'text-cyan-400' : 'text-white/50'}`} />
                <span className={`font-semibold ${form.tournament_family === 'esports' ? 'text-white' : 'text-white/70'}`}>
                  Esports
                </span>
              </div>
              <p className="text-xs text-white/40">Brackets, elimination, Swiss</p>
            </button>
            
            <button
              onClick={() => setForm(prev => ({ 
                ...prev, 
                tournament_family: 'football', 
                tournament_type: 'league' 
              }))}
              className={`p-4 rounded-xl border text-left transition-all ${
                form.tournament_family === 'football'
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-white/10 bg-white/3 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Medal className={`w-5 h-5 ${form.tournament_family === 'football' ? 'text-green-400' : 'text-white/50'}`} />
                <span className={`font-semibold ${form.tournament_family === 'football' ? 'text-white' : 'text-white/70'}`}>
                  Football/League
                </span>
              </div>
              <p className="text-xs text-white/40">Tables, fixtures, standings</p>
            </button>
          </div>

          {/* Format Selection */}
          <div>
            <FieldLabel label="Specific Format" required />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {form.tournament_family === 'esports' ? (
                <>
                  {[
                    { id: 'single_elimination', label: 'Single Elimination', desc: 'Lose once = out' },
                    { id: 'double_elimination', label: 'Double Elimination', desc: 'Lose twice = out' },
                    { id: 'swiss', label: 'Swiss', desc: 'Fixed rounds, pair by record' },
                    { id: 'round_robin', label: 'Round Robin', desc: 'Everyone plays everyone' },
                    { id: 'ladder', label: 'Ladder', desc: 'Challenge-based ranking' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setForm(prev => ({ ...prev, tournament_type: f.id as BracketType }))}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        form.tournament_type === f.id
                          ? 'bg-cyan-500/15 border-cyan-500/35 text-cyan-400'
                          : 'border-white/10 text-white/50 hover:border-white/20'
                      }`}
                    >
                      <p className="font-semibold text-sm">{f.label}</p>
                      <p className="text-[10px] opacity-70">{f.desc}</p>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {[
                    { id: 'league', label: 'League / Round Robin', desc: 'Full table with home/away' },
                    { id: 'group_stage', label: 'Group Stage Only', desc: 'Multiple groups, no knockout' },
                    { id: 'group_knockout', label: 'Groups + Knockout', desc: 'Group stage then playoffs' },
                    { id: 'knockout', label: 'Knockout Only', desc: 'Direct elimination bracket' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setForm(prev => ({ ...prev, tournament_type: f.id as FootballType }))}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        form.tournament_type === f.id
                          ? 'bg-green-500/15 border-green-500/35 text-green-400'
                          : 'border-white/10 text-white/50 hover:border-white/20'
                      }`}
                    >
                      <p className="font-semibold text-sm">{f.label}</p>
                      <p className="text-[10px] opacity-70">{f.desc}</p>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Easy Mode for eFootball */}
          {isEFootball && (
            <div 
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                form.tournament_family === 'football' ? 'border-green-500/30 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5'
              }`}
              onClick={() => {
                setForm(prev => ({
                  ...prev,
                  format: EFOOTBALL_EASY_MODE.format,
                  max_players: EFOOTBALL_EASY_MODE.max_players,
                  rules: prev.rules || EFOOTBALL_EASY_MODE.rules,
                }));
                toast.success('eFootball settings applied!');
              }}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${form.tournament_family === 'football' ? 'bg-green-500/15' : 'bg-yellow-500/15'}`}>
                  <Sparkles className={`w-5 h-5 ${form.tournament_family === 'football' ? 'text-green-400' : 'text-yellow-400'}`} />
                </div>
                <div>
                  <p className={`font-orbitron font-bold text-sm ${form.tournament_family === 'football' ? 'text-green-400' : 'text-yellow-400'}`}>
                    ⚡ eFootball Quick Setup
                  </p>
                  <p className="text-xs text-white/40">
                    Auto-configure recommended settings for eFootball tournaments
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function TournamentCreateNew() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { organizers, loading: organizersLoading } = useHostableOrganizers();
  
  const [step, setStep] = useState(0);
  const [games, setGames] = useState<Game[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<TournamentForm>({
    organizer_id: '',
    game_id: '',
    tournament_family: 'esports',
    tournament_type: 'single_elimination',
    name: '',
    description: '',
    format: 'best_of_1',
    max_players: 16,
    team_size: 1,
    date: '',
    registration_closes: '',
    check_in_open: '',
    check_in_close: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    entry_fee: 0,
    prize_amount: 0,
    currency: 'PulsePoints',
    rules: '',
    is_public: true,
    requires_check_in: true,
  });

  useEffect(() => {
    supabase.from('games').select('id, name, icon, logo_url, category').order('name')
      .then(({ data }) => setGames((data as Game[]) ?? []));
  }, []);

  const validateStep = (): string | null => {
    switch (step) {
      case 0: // Organizer
        if (!form.organizer_id) return 'Select an organizer';
        return null;
      case 1: // Game
        if (!form.game_id) return 'Select a game';
        if (!form.tournament_type) return 'Select a tournament format';
        return null;
      case 2: // Details
        if (!form.name.trim()) return 'Tournament name is required';
        return null;
      case 3: // Schedule
        if (!form.date) return 'Tournament start date is required';
        return null;
      default:
        return null;
    }
  };

  const nextStep = () => {
    const err = validateStep();
    if (err) { toast.error(err); return; }
    if (step < STEPS.length - 1) setStep(s => s + 1);
  };

  const createTournament = async () => {
    if (!user) return;
    setSaving(true);

    const { data, error } = await supabase.from('tournaments').insert({
      organizer_id: form.organizer_id,
      name: form.name.trim(),
      game_id: form.game_id,
      status: 'upcoming',
      tournament_family: form.tournament_family,
      tournament_type: form.tournament_type,
      date: form.date,
      prize_pool: form.prize_amount > 0 ? `${form.prize_amount} PP` : '0',
      prize_amount: form.prize_amount,
      entry_fee: form.entry_fee,
      currency: form.currency,
      max_players: form.max_players,
      team_size: form.team_size,
      duration: form.format === 'best_of_1' ? '2h' : form.format === 'best_of_3' ? '4h' : '6h',
      format: form.format,
      rules: form.rules.trim() || null,
      description: form.description.trim() || null,
      is_public: form.is_public,
      requires_check_in: form.requires_check_in,
      registration_closes: form.registration_closes || null,
      check_in_open: form.check_in_open || null,
      check_in_close: form.check_in_close || null,
      created_by: user.id,
      season_name: form.season_name || null,
      season_year: form.season_year || null,
    } as any).select('id').single();

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    const tId = (data as { id: string }).id;

    // Add creator as tournament host
    await supabase.from('tournament_staff').insert({
      tournament_id: tId,
      user_id: user.id,
      role: 'host',
      added_by: user.id,
    } as any);

    // Audit log
    await writeAuditLog({ 
      actor_id: user.id, 
      action: 'tournament.create', 
      entity_type: 'tournament', 
      entity_id: tId, 
      data: { name: form.name, organizer_id: form.organizer_id } 
    });

    toast.success('Tournament created successfully! 🏆');
    navigate(`/tournaments/${tId}`);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-6 text-center">
        <div>
          <Shield className="w-14 h-14 mx-auto text-white/20 mb-4" />
          <p className="text-white/50 text-lg mb-4">Sign in to create tournaments</p>
          <Button asChild className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
            <Link to="/signin">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  const selectedOrganizer = organizers.find(o => o.id === form.organizer_id);
  const selectedGame = games.find(g => g.id === form.game_id);

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/tournaments" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />Back to Tournaments
        </Link>

        <div className="text-center mb-8">
          <h1 className="font-orbitron text-2xl sm:text-3xl font-black text-white mb-2">
            Create Tournament
          </h1>
          <p className="text-white/40 text-sm">
            Set up a professional competition for your community
          </p>
        </div>

        <StepIndicator currentStep={step} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="gaming-card p-5 sm:p-8"
          >
            {step === 0 && (
              <StepOrganizer
                form={form}
                setForm={setForm}
                organizers={organizers}
                loading={organizersLoading}
              />
            )}
            
            {step === 1 && (
              <StepGame
                form={form}
                setForm={setForm}
                games={games}
              />
            )}
            
            {step === 2 && (
              <div className="space-y-5">
                <h2 className="font-orbitron font-bold text-lg text-white">Tournament Details</h2>
                
                <div>
                  <FieldLabel label="Tournament Name" required />
                  <Input
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Lagos eFootball Cup #3"
                    className={inputCls}
                  />
                </div>

                <div>
                  <FieldLabel label="Description" hint="Shown on tournament page" />
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your tournament..."
                    className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 resize-none h-20 focus:outline-none focus:border-cyan-500/40 placeholder:text-white/25"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel label="Match Format" />
                    <div className="grid grid-cols-1 gap-2">
                      {(['best_of_1', 'best_of_3', 'best_of_5'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setForm(prev => ({ ...prev, format: f }))}
                          className={`py-2 rounded-lg border text-xs font-bold transition-all ${
                            form.format === f ? 'bg-cyan-500/15 border-cyan-500/35 text-cyan-400' : 'border-white/10 text-white/45 hover:border-white/20'
                          }`}
                        >
                          {f.replace('_', ' ').replace('best of', 'BO').toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <FieldLabel label="Max Players" hint="Must be power of 2 for brackets" />
                    <div className="grid grid-cols-3 gap-1.5">
                      {[8, 16, 32, 64, 128, 256].map(n => (
                        <button
                          key={n}
                          onClick={() => setForm(prev => ({ ...prev, max_players: n }))}
                          className={`py-2 rounded-lg border text-xs font-orbitron font-black transition-all ${
                            form.max_players === n ? 'bg-purple-500/15 border-purple-500/35 text-purple-400' : 'border-white/10 text-white/45 hover:border-white/20'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <FieldLabel label="Visibility" />
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: true, icon: Globe, label: 'Public', desc: 'Anyone can join' },
                      { val: false, icon: Lock, label: 'Private', desc: 'Invite only' }
                    ].map(o => (
                      <button
                        key={String(o.val)}
                        onClick={() => setForm(prev => ({ ...prev, is_public: o.val }))}
                        className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                          form.is_public === o.val ? 'bg-white/8 border-white/20' : 'border-white/8 hover:border-white/15'
                        }`}
                      >
                        <o.icon className="w-4 h-4 text-white/50 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-white">{o.label}</p>
                          <p className="text-[10px] text-white/35">{o.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel label="Rules" hint="Rules shown to all participants" />
                  <textarea
                    value={form.rules}
                    onChange={(e) => setForm(prev => ({ ...prev, rules: e.target.value }))}
                    placeholder="Match rules, format details, code of conduct..."
                    rows={6}
                    className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-cyan-500/40 placeholder:text-white/25"
                  />
                </div>
              </div>
            )}
            
            {step === 3 && (
              <div className="space-y-5">
                <h2 className="font-orbitron font-bold text-lg text-white">Schedule</h2>
                
                <div>
                  <FieldLabel label="Tournament Start" required />
                  <input
                    type="datetime-local"
                    value={form.date}
                    onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 h-10 text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <FieldLabel label="Registration Closes" hint="Players can't join after this" />
                  <input
                    type="datetime-local"
                    value={form.registration_closes}
                    onChange={(e) => setForm(prev => ({ ...prev, registration_closes: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 h-10 text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/8 border border-blue-500/15">
                  <input
                    type="checkbox"
                    id="checkin"
                    checked={form.requires_check_in}
                    onChange={(e) => setForm(prev => ({ ...prev, requires_check_in: e.target.checked }))}
                    className="rounded border-white/20 bg-white/5"
                  />
                  <label htmlFor="checkin" className="text-sm text-blue-400">
                    Require check-in before tournament starts
                  </label>
                </div>

                {form.requires_check_in && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-2 gap-4">
                    <div>
                      <FieldLabel label="Check-in Opens" />
                      <input
                        type="datetime-local"
                        value={form.check_in_open}
                        onChange={(e) => setForm(prev => ({ ...prev, check_in_open: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 h-10 text-sm focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <FieldLabel label="Check-in Closes" />
                      <input
                        type="datetime-local"
                        value={form.check_in_close}
                        onChange={(e) => setForm(prev => ({ ...prev, check_in_close: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 h-10 text-sm focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                  </motion.div>
                )}

                <div className="p-4 rounded-xl bg-yellow-500/8 border border-yellow-500/15">
                  <p className="text-xs text-yellow-400">
                    💡 Tip: Set check-in 30–60 minutes before start. Players who don't check in won't be placed in bracket.
                  </p>
                </div>
              </div>
            )}
            
            {step === 4 && (
              <div className="space-y-5">
                <h2 className="font-orbitron font-bold text-lg text-white">Prize & Entry</h2>
                
                <div>
                  <FieldLabel label="Entry Fee (PulsePoints)" hint="0 = free to enter" />
                  <Input
                    type="number"
                    min="0"
                    value={form.entry_fee === 0 ? '' : form.entry_fee}
                    onChange={(e) => setForm(prev => ({ ...prev, entry_fee: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>

                <div>
                  <FieldLabel label="Prize Pool (PulsePoints)" hint="Winner receives this amount" />
                  <Input
                    type="number"
                    min="0"
                    value={form.prize_amount === 0 ? '' : form.prize_amount}
                    onChange={(e) => setForm(prev => ({ ...prev, prize_amount: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>

                {form.entry_fee > 0 && form.prize_amount > 0 && (
                  <div className="p-4 rounded-xl bg-cyan-500/8 border border-cyan-500/15 space-y-1">
                    <p className="text-xs text-cyan-400 font-semibold">Prize breakdown</p>
                    <p className="text-xs text-white/50">🥇 Winner: {form.prize_amount} PP + 150 GamerCred</p>
                    <p className="text-xs text-white/35">🥈 Runner-up: 200 PP + 75 GamerCred</p>
                  </div>
                )}
              </div>
            )}
            
            {step === 5 && (
              <div className="space-y-5">
                <h2 className="font-orbitron font-bold text-lg text-white">Review & Create</h2>
                
                <div className="p-5 rounded-2xl bg-white/4 border border-white/10 space-y-4">
                  <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                    <Avatar className="w-12 h-12 rounded-xl">
                      <AvatarImage src={selectedOrganizer?.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl">
                        <Building2 className="w-5 h-5 text-white" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-orbitron font-bold text-base text-white">{form.name}</p>
                      <p className="text-xs text-white/40">Hosted by {selectedOrganizer?.name}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                    {[
                      ['Game', selectedGame?.name || '-'],
                      ['Format', form.tournament_family === 'esports' ? 'Esports' : 'Football/League'],
                      ['Type', form.tournament_type.replace(/_/g, ' ')],
                      ['Match Format', form.format.replace(/_/g, ' ').toUpperCase()],
                      ['Players', `up to ${form.max_players}`],
                      ['Entry', form.entry_fee > 0 ? `${form.entry_fee} PP` : 'Free'],
                      ['Prize', form.prize_amount > 0 ? `${form.prize_amount} PP` : 'None'],
                      ['Start', form.date ? new Date(form.date).toLocaleString() : 'TBD'],
                      ['Visibility', form.is_public ? 'Public' : 'Private'],
                      ['Check-in', form.requires_check_in ? 'Required' : 'Not required'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between">
                        <span className="text-white/40 text-xs">{k}</span>
                        <span className="text-white text-xs font-semibold capitalize">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-yellow-500/8 border border-yellow-500/15">
                  <p className="text-xs text-yellow-400">
                    ⚠ Once created, you'll be able to manage registrations, generate brackets, and more from the tournament page.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center gap-3 mt-8">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-white/12 text-white/55 text-sm hover:bg-white/5 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />Back
            </button>
          )}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <button
              onClick={nextStep}
              className="flex items-center gap-1.5 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm hover:opacity-90 transition-all"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={createTournament}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
              Create Tournament
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
