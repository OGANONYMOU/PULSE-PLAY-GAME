import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Gamepad2, Trophy, Users, ArrowRight, Sparkles, Target, Flame, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';

const previewCards = [
  {
    icon: Gamepad2,
    title: 'Trending Games',
    description: 'Discover the hottest mobile games dominating the Nigerian scene',
    link: '/games',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    icon: Trophy,
    title: 'Live Tournaments',
    description: 'Compete in exciting battles and win massive cash prizes',
    link: '/tournaments',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: Users,
    title: 'Join Community',
    description: 'Connect with 10,000+ gamers and share your gaming journey',
    link: '/community',
    color: 'from-pink-500 to-red-500',
  },
];

const stats = [
  { value: '10K+', label: 'Active Players',   icon: Users,       color: 'text-cyan-400' },
  { value: '50+',  label: 'Tournaments',       icon: Trophy,      color: 'text-purple-400' },
  { value: '₦5M+', label: 'Prize Pool',        icon: DollarSign,  color: 'text-yellow-400' },
];

export function Home() {
  return (
    <div className="min-h-screen pt-20 sm:pt-24 overflow-x-hidden">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center px-4 sm:px-6 py-16 sm:py-24 min-h-[85vh]">
        {/* Decorative blobs — hidden on tiny phones to avoid overflow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none hidden sm:block">
          <motion.div
            animate={{ y: [0, -22, 0], rotate: [0, 4, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-24 left-[5%] w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-transparent border border-cyan-500/30"
          />
          <motion.div
            animate={{ y: [0, 18, 0], rotate: [0, -4, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute top-40 right-[5%] w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-purple-500/20 to-transparent border border-purple-500/30"
          />
          <motion.div
            animate={{ y: [0, -18, 0], rotate: [0, 8, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            className="absolute bottom-32 left-1/4 w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-pink-500/10 to-transparent border border-pink-500/20"
          />
        </div>

        {/* Hero content */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto relative z-10 w-full"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs sm:text-sm font-medium mb-6"
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span>Nigeria's Premier Mobile Gaming Platform</span>
          </motion.div>

          <h1 className="font-orbitron text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-5 leading-tight">
            <span className="gradient-text">Stay in the Pulse</span>
            <br />
            <span className="text-foreground">of Gaming</span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-8 px-2">
            Real tournaments, real prizes, real competition.
            Join thousands of mobile gamers competing across Nigeria.
          </p>

          <div className="flex flex-col xs:flex-row gap-3 justify-center items-center px-4 sm:px-0">
            <Button
              asChild
              size="lg"
              className="w-full xs:w-auto bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 text-white font-bold text-sm sm:text-base px-6 sm:px-8 h-12 sm:h-14 rounded-xl shadow-lg transition-all"
            >
              <Link to="/community">
                Join the Community
                <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full xs:w-auto border-2 border-purple-500/50 hover:bg-purple-500/10 font-bold text-sm sm:text-base px-6 sm:px-8 h-12 sm:h-14 rounded-xl"
            >
              <Link to="/tournaments">
                <Trophy className="mr-2 w-4 h-4 sm:w-5 sm:h-5" />
                View Tournaments
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="grid grid-cols-3 gap-3 sm:gap-5 mt-12 sm:mt-16 max-w-2xl w-full px-4 sm:px-6"
        >
          {stats.map(({ value, label, icon: Icon, color }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.08 }}
              className="gaming-card p-3 sm:p-5 text-center"
            >
              <Icon className={`w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1.5 ${color}`} />
              <div className="font-orbitron text-xl sm:text-2xl font-black gradient-text">{value}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-tight">{label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Preview Cards ────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 content-section">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10 sm:mb-14"
          >
            <h2 className="section-title mb-3">What's Hot Right Now</h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto">
              Trending games and upcoming tournaments across the community
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {previewCards.map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
              >
                <Link to={card.link} className="block group h-full">
                  <div className="gaming-card p-6 sm:p-7 h-full flex flex-col">
                    <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300`}>
                      <card.icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                    </div>
                    <h3 className="font-orbitron text-lg sm:text-xl font-bold text-cyan-400 mb-2">
                      {card.title}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-5 flex-1 leading-relaxed">
                      {card.description}
                    </p>
                    <div className="flex items-center text-purple-400 font-bold text-sm group-hover:text-cyan-400 transition-colors">
                      <span>Explore</span>
                      <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                    </div>
                    {/* Shine */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/4 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Highlight ─────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden content-section">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-cyan-500/5 pointer-events-none" />
        <div className="max-w-6xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-14 items-center">

            {/* Text */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-sm font-medium mb-5">
                <Target className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span className="text-purple-400">Live Right Now</span>
              </div>
              <h2 className="font-orbitron text-2xl sm:text-3xl md:text-4xl font-bold mb-5 leading-tight">
                Real-Time Tournament
                <span className="gradient-text"> Tracking</span>
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg mb-7 leading-relaxed">
                Live brackets, player rankings, and match scores — updated in real time.
                Register, check in, and compete without ever leaving the app.
              </p>
              <Button
                asChild
                variant="outline"
                className="border-2 border-cyan-500/50 hover:bg-cyan-500/10 font-bold px-6 h-11 rounded-xl"
              >
                <Link to="/tournaments">
                  Browse Tournaments
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </motion.div>

            {/* Visual cards — responsive, no pixel-width overflow */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.15 }}
              className="relative hidden sm:block"
            >
              <div className="relative h-72 sm:h-80 md:h-[360px]">
                <motion.div
                  animate={{ y: [0, -12, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute top-0 left-0 w-[55%] rounded-2xl glass border border-cyan-500/30 p-4"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                      <Trophy className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">Live Tournament</div>
                      <div className="text-xs text-muted-foreground">eFootball Finals</div>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full w-3/4 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full" />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                    <span>Round 3 of 5</span><span>75%</span>
                  </div>
                </motion.div>

                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                  className="absolute top-20 right-0 w-[48%] rounded-2xl glass border border-purple-500/30 p-4"
                >
                  <div className="text-sm font-bold mb-2.5 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-red-400" />Leaderboard
                  </div>
                  <div className="space-y-2">
                    {['ProGamer_X', 'EliteSniper', 'GhostRider'].map((name, i) => (
                      <div key={name} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-3">{i + 1}</span>
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0" />
                        <span className="text-xs truncate">{name}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  animate={{ y: [0, -14, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  className="absolute bottom-0 left-[10%] w-[52%] rounded-2xl glass border border-pink-500/30 p-4"
                >
                  <div className="text-sm font-bold mb-1">Prize Pool</div>
                  <div className="font-orbitron text-xl font-bold gradient-text">₦500,000</div>
                  <div className="text-[10px] text-muted-foreground mt-1">128 players competing</div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 content-section">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="gaming-card p-8 sm:p-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 sm:w-96 h-64 sm:h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <h2 className="font-orbitron text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
                Ready to <span className="gradient-text">Level Up?</span>
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg mb-7 max-w-md mx-auto">
                Join thousands of Nigerian mobile gamers competing for glory and prizes. Free to start.
              </p>
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90 text-white font-bold text-sm sm:text-base px-8 sm:px-10 h-12 sm:h-14 rounded-xl w-full sm:w-auto"
              >
                <Link to="/register">
                  Create Free Account
                  <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}