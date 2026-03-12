import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Gamepad2, Trophy, Users, ArrowRight, Sparkles, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui-custom/StatCard';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';

const previewCards = [
  {
    icon: Gamepad2,
    title: 'Trending Games',
    description: 'Discover the hottest mobile games dominating the scene',
    link: '/games',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    icon: Trophy,
    title: 'Live Tournaments',
    description: 'Compete in exciting battles and win massive prizes',
    link: '/tournaments',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: Users,
    title: 'Join Community',
    description: 'Connect with gamers and share your gaming journey',
    link: '/community',
    color: 'from-pink-500 to-red-500',
  },
];

export function Home() {
  const { isAuthenticated } = useAuth();
  const { symbol } = useCurrency();

  const stats = [
    { value: '10K+', label: 'Active Players' },
    { value: '50+',  label: 'Tournaments' },
    { value: symbol + '0', label: 'Prize Pool' },
  ];

  return (
    <div className="min-h-screen pt-20 sm:pt-24">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] sm:min-h-[90vh] flex flex-col items-center justify-center px-4 sm:px-6">
        {/* Floating Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ y: [0, -30, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-20 left-10 w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-transparent border border-cyan-500/30"
          />
          <motion.div
            animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute top-40 right-20 w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/20 to-transparent border border-purple-500/30"
          />
          <motion.div
            animate={{ y: [0, -25, 0], rotate: [0, 10, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            className="absolute bottom-40 left-1/4 w-24 h-24 rounded-3xl bg-gradient-to-br from-pink-500/10 to-transparent border border-pink-500/20"
          />
        </div>

        {/* Hero Content */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto relative z-10"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm font-medium mb-6"
          >
            <Sparkles className="w-4 h-4" />
            <span>Welcome to the Future of Mobile Gaming</span>
          </motion.div>

          <h1 className="font-orbitron text-3xl sm:text-5xl md:text-7xl font-black mb-4 sm:mb-6 leading-tight">
            <span className="gradient-text">Stay in the Pulse</span>
            <br />
            <span className="text-foreground">of Gaming</span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 px-2">
            Get the latest updates, news, and tournaments for mobile gamers.{' '}
            {isAuthenticated
              ? 'Jump back in and keep competing.'
              : 'Join thousands of players competing for real prizes.'}
          </p>

          {/* CTA buttons — differ for authenticated vs guest */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <>
                <Button asChild size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 rounded-xl shadow-glow hover:shadow-glow-lg transition-all">
                  <Link to="/tournaments">
                    <Trophy className="mr-2 w-5 h-5" />
                    Browse Tournaments
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline"
                  className="border-2 border-purple-500/50 hover:bg-purple-500/10 font-bold text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 rounded-xl">
                  <Link to="/community">
                    <Users className="mr-2 w-5 h-5" />
                    Community
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 rounded-xl shadow-glow hover:shadow-glow-lg transition-all">
                  <Link to="/community">
                    Join the Community
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline"
                  className="border-2 border-purple-500/50 hover:bg-purple-500/10 font-bold text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 rounded-xl">
                  <Link to="/tournaments">
                    <Trophy className="mr-2 w-5 h-5" />
                    View Tournaments
                  </Link>
                </Button>
              </>
            )}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 max-w-3xl w-full px-4"
        >
          {stats.map((stat, index) => (
            <StatCard key={stat.label} value={stat.value} label={stat.label} delay={0.5 + index * 0.1} />
          ))}
        </motion.div>
      </section>

      {/* Preview Section */}
      <section className="py-14 sm:py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10 sm:mb-16"
          >
            <h2 className="section-title mb-4">What&apos;s Hot Right Now</h2>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
              Check out trending games and upcoming tournaments
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-8">
            {previewCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Link to={card.link} className="block group">
                  <div className="gaming-card p-8 h-full">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                      <card.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="font-orbitron text-xl font-bold text-cyan-400 mb-3">{card.title}</h3>
                    <p className="text-muted-foreground mb-6">{card.description}</p>
                    <div className="flex items-center text-purple-400 font-bold group-hover:text-cyan-400 transition-colors">
                      <span>Explore</span>
                      <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-2 transition-transform" />
                    </div>
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Section */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-cyan-500/5" />
        <div className="max-w-7xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-sm font-medium mb-6">
                <Target className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400">New Feature</span>
              </div>
              <h2 className="font-orbitron text-3xl md:text-4xl font-bold mb-6">
                Real-Time Tournament
                <span className="gradient-text"> Tracking</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                Stay updated with live scores, brackets, and player rankings across all tournaments.
                Never miss a moment of the action with our real-time tracking system.
              </p>
              <Button asChild variant="outline"
                className="border-2 border-cyan-500/50 hover:bg-cyan-500/10 font-bold px-6 py-5 rounded-xl">
                <Link to="/tournaments">
                  Learn More <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative h-[400px] perspective-1000">
                <motion.div
                  animate={{ y: [0, -15, 0], rotateY: [0, 5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute top-0 left-0 w-64 h-40 rounded-2xl glass border border-cyan-500/30 p-4"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">Live Tournament</div>
                      <div className="text-xs text-muted-foreground">CODM Championship</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full w-3/4 bg-gradient-to-r from-cyan-500 to-purple-500" />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Round 3 of 5</span><span>75%</span>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  animate={{ y: [0, 10, 0], rotateY: [0, -3, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                  className="absolute top-24 right-0 w-56 h-36 rounded-2xl glass border border-purple-500/30 p-4"
                >
                  <div className="text-sm font-bold mb-3">Leaderboard</div>
                  <div className="space-y-2">
                    {['ProGamer_X', 'EliteSniper', 'GhostRider'].map((name, i) => (
                      <div key={name} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                        <span className="text-xs">{name}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  animate={{ y: [0, -20, 0], rotateY: [0, 8, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  className="absolute bottom-0 left-12 w-60 h-32 rounded-2xl glass border border-pink-500/30 p-4"
                >
                  <div className="text-sm font-bold mb-2">Prize Pool</div>
                  {/* Prize pool defaults to zero */}
                  <div className="font-orbitron text-2xl font-bold gradient-text">{symbol}0</div>
                  <div className="text-xs text-muted-foreground mt-1">Prizes coming soon</div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section — only shown to guests */}
      {!isAuthenticated ? (
        <section className="py-14 sm:py-24 px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
          >
            <div className="gaming-card p-7 sm:p-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
              <div className="relative z-10">
                <h2 className="font-orbitron text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
                  Ready to <span className="gradient-text">Level Up?</span>
                </h2>
                <p className="text-muted-foreground text-base sm:text-lg mb-7 sm:mb-8 max-w-xl mx-auto">
                  Join thousands of mobile gamers competing for glory and prizes.
                  Sign up free and start your journey today.
                </p>
                <Button asChild size="lg"
                  className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-bold text-base sm:text-lg px-8 sm:px-10 py-5 sm:py-6 rounded-xl">
                  <Link to="/register">
                    Create Free Account
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </section>
      ) : null}
    </div>
  );
}
