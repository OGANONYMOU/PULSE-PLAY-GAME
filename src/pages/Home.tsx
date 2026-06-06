import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { HomeSEO } from '@/components/SEO';
import { 
  Trophy, Users, ArrowRight, Sparkles, Shield, 
  Zap, Video, Crown, Play, ChevronRight,
  Gem, Lock, CheckCircle2, Award, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════════════════════
// PULSEPLAY HOMEPAGE - Premium Investor-Grade Experience
// No fake data. No mock stats. Real platform value only.
// ═══════════════════════════════════════════════════════════════════════════════

const ecosystemFeatures = [
  {
    icon: Trophy,
    title: 'Elite Tournaments',
    description: 'Compete in skill-based tournaments with verified brackets, real-time scoring, and instant prize distribution.',
    color: 'from-amber-500 to-orange-500',
    highlight: true,
  },
  {
    icon: Video,
    title: 'Clip Culture',
    description: 'Share your best moments. Build your reputation through gameplay highlights and community recognition.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: Users,
    title: 'Rivalries & Clubs',
    description: 'Form squads, challenge rivals, and build lasting gaming relationships that go beyond the match.',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    icon: Crown,
    title: 'GamerCred System',
    description: 'Earn reputation through consistent performance. Your skill speaks louder than words.',
    color: 'from-emerald-500 to-teal-500',
  },
];

const hostingFeatures = [
  {
    icon: Zap,
    title: 'Instant Tournament Creation',
    description: 'Set up tournaments in minutes with automated brackets, scheduling, and match management.',
  },
  {
    icon: Shield,
    title: 'Dispute Resolution',
    description: 'Built-in moderation tools and dispute systems keep your competitions fair and professional.',
  },
  {
    icon: Lock,
    title: 'Fraud Protection',
    description: 'Advanced monitoring detects suspicious patterns before they impact your community.',
  },
  {
    icon: Award,
    title: 'Verified Results',
    description: 'Every match is logged, every result is verified. Full audit trails for complete transparency.',
  },
];

const trustFeatures = [
  'End-to-end encrypted match reporting',
  'Multi-layer dispute arbitration',
  'Real-time fraud detection algorithms',
  'Transparent audit logging',
  'Community-driven moderation',
  'Automated prize distribution',
];

// 3D Floating Card Component
const FloatingCard = ({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotateX: 10 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8, rotateX: 5, transition: { duration: 0.3 } }}
      className={`${className}`}
      style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
    >
      {children}
    </motion.div>
  );
};

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, -100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0.3]);
  
  // Auth state
  const { isAuthenticated, signInWithOAuth } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await signInWithOAuth('google');
      if (error) {
        toast.error(error.message || 'Failed to sign in with Google');
      } else {
        toast.success('Redirecting to Google...');
      }
    } catch (_err) {
      toast.error('An unexpected error occurred');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-background overflow-x-hidden">
      <HomeSEO />
      {/* ═══════════════════════════════════════════════════════════════════════════════
          HERO SECTION - Premium Visual Centerpiece
          No fake stats. Strong headline. Clear CTAs. 3D floating elements.
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-20">
        {/* Layered Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background" />
          
          {/* Subtle glows - reduced intensity */}
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-cyan-600/8 rounded-full blur-[80px]" />
          
          {/* Grid pattern */}
          <div 
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <motion.div 
          style={{ y: heroY, opacity: heroOpacity }}
          className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 relative z-10"
        >
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge - tighter margin */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-purple-500/20 mb-6">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-medium text-purple-300 tracking-wide uppercase">
                  Nigeria's Premier Mobile Gaming Ecosystem
                </span>
              </div>
            </motion.div>

            {/* Headline - tighter spacing */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="font-orbitron text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-5 leading-[1.05] tracking-tight"
            >
              <span className="block">Compete at</span>
              <span className="block bg-gradient-to-r from-purple-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Your Peak
              </span>
            </motion.h1>

            {/* Subheadline - shorter, punchier */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed"
            >
              The complete platform for mobile gamers. 
              <span className="text-foreground">Tournaments. Community. Identity.</span>
            </motion.p>

            {/* CTAs - conditional based on auth state */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              {isAuthenticated ? (
                <>
                  <Button
                    asChild
                    size="lg"
                    className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:opacity-90 text-white font-semibold text-base px-8 h-12 rounded-lg shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-300"
                  >
                    <Link to="/tournaments">
                      Browse Tournaments
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="border-white/15 hover:bg-white/[0.03] text-base px-8 h-12 rounded-lg transition-all duration-300"
                  >
                    <Link to="/profile">
                      <Play className="mr-2 w-4 h-4" />
                      View Profile
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="lg"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                    className="bg-white/10 hover:bg-white/20 text-white font-semibold text-base px-8 h-12 rounded-lg border border-white/20 transition-all duration-300"
                  >
                    {googleLoading ? (
                      <>
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <span className="inline-flex h-5 w-5 rounded-full bg-white text-black font-bold items-center justify-center text-[10px] mr-2">G</span>
                        Sign in with Google
                      </>
                    )}
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="border-white/15 hover:bg-white/[0.03] text-base px-8 h-12 rounded-lg transition-all duration-300"
                  >
                    <Link to="/register">
                      Create Account
                      <ChevronRight className="ml-2 w-4 h-4" />
                    </Link>
                  </Button>
                </>
              )}
            </motion.div>

            {/* Trust indicators - tighter */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-10 flex flex-wrap items-center justify-center gap-5 text-sm text-muted-foreground"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Free to join</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Verified tournaments</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Instant prizes</span>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Floating 3D Elements - Minimal, premium depth */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            animate={{ 
              y: [0, -12, 0], 
              rotateY: [0, 3, 0],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/4 right-[15%] w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/15 to-cyan-500/15 border border-white/5 hidden lg:block"
          />
          <motion.div
            animate={{ 
              y: [0, 10, 0], 
              rotateY: [0, -4, 0],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-1/3 left-[10%] w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/15 to-orange-500/15 border border-white/5 hidden lg:block"
          />
          <motion.div
            animate={{ 
              y: [0, -8, 0], 
              rotateX: [0, 5, 0],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute top-1/3 left-[20%] w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border border-white/5 hidden lg:block"
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          PLATFORM VALUE SECTION - What PulsePlay Actually Is
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="text-sm font-medium text-purple-400 tracking-wider uppercase mb-4 block">
              The Complete Platform
            </span>
            <h2 className="font-orbitron text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              More Than Just <span className="gradient-text">Tournaments</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              PulsePlay is a full gaming ecosystem where competition meets community. 
              Play, share, connect, and build your reputation.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {ecosystemFeatures.map((feature, index) => (
              <FloatingCard key={index} delay={index * 0.1}>
                <div className={`group relative p-8 rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/10 hover:border-purple-500/30 transition-all duration-500 ${
                  feature.highlight ? 'md:col-span-2' : ''
                }`}>
                  {/* Subtle glow on hover */}
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                  
                  <div className="relative z-10">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${feature.color} p-3 mb-6 shadow-lg`}>
                      <feature.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="font-orbitron text-2xl font-bold mb-3 group-hover:text-purple-300 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-lg leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </FloatingCard>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          HOSTING / ORGANIZER SECTION
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 relative overflow-hidden">
        {/* Background accent */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="text-sm font-medium text-cyan-400 tracking-wider uppercase mb-4 block">
                For Organizers
              </span>
              <h2 className="font-orbitron text-3xl sm:text-4xl md:text-5xl font-bold mb-6 leading-tight">
                Build and Host{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  Elite Competitions
                </span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                Whether you're a community leader, brand manager, or esports organizer, 
                PulsePlay gives you enterprise-grade tournament tools with consumer-friendly simplicity.
              </p>

              <div className="space-y-4">
                {hostingFeatures.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/20 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{feature.title}</h4>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Glass CTA Card - Reduced blur for readability */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="relative p-7 sm:p-9 rounded-2xl bg-white/[0.03] border border-white/10 shadow-xl overflow-hidden">
                {/* Subtle glow */}
                <div className="absolute -top-16 -right-16 w-32 h-32 bg-cyan-500/15 rounded-full blur-2xl" />
                
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 p-3.5 mb-5 shadow-lg shadow-cyan-500/20">
                    <Crown className="w-7 h-7 text-white" />
                  </div>
                  
                  <h3 className="font-orbitron text-xl font-bold mb-2">
                    Ready to Host?
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                    Apply for organizer status and start building your competitive community.
                  </p>
                  
                  <Button
                    asChild
                    size="lg"
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:opacity-90 text-white font-semibold h-12 rounded-lg"
                  >
                    <Link to="/about">
                      Learn About Hosting
                      <ChevronRight className="ml-2 w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          TRUST / INTEGRITY SECTION - Security & Transparency
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-5">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-300 uppercase tracking-wide">Competitive Integrity</span>
              </div>
              <h2 className="font-orbitron text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
                Trust Built on{' '}
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Transparency
                </span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Every match verified. Every dispute resolved. Every action logged.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="grid sm:grid-cols-2 gap-3"
            >
              {trustFeatures.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-emerald-500/25 transition-all duration-300 group"
                >
                  <div className="w-8 h-8 rounded-md bg-emerald-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/15 transition-colors">
                    <Lock className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="font-medium text-sm">{feature}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          AUTHENTICATION SECTION - Only shown when not logged in
          ═══════════════════════════════════════════════════════════════════════════════ */}
      {!isAuthenticated && (
        <section className="py-20 sm:py-28 relative overflow-hidden border-t border-white/[0.08]">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-cyan-500/8 via-transparent to-transparent rounded-full" />
          </div>

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
              {/* Left: Sign in section */}
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="relative p-8 sm:p-10 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl" />
                  
                  <div className="relative z-10">
                    <h3 className="font-orbitron text-2xl font-bold mb-3">
                      Already a member?
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Sign in to your account and jump back into the action. Continue your tournaments, view your stats, and connect with the community.
                    </p>
                    
                    <Button
                      asChild
                      size="lg"
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:opacity-90 text-white font-semibold h-12 rounded-lg"
                    >
                      <Link to="/signin">
                        Sign In
                        <ChevronRight className="ml-2 w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </motion.div>

              {/* Right: Create account section */}
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="relative p-8 sm:p-10 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/5 border border-purple-500/20 overflow-hidden">
                  <div className="absolute top-0 left-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
                  
                  <div className="relative z-10">
                    <h3 className="font-orbitron text-2xl font-bold mb-3">
                      New to PulsePlay?
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Join Nigeria's premier gaming platform. Create your account today and start competing.
                    </p>
                    <p className="text-muted-foreground text-sm mb-6 font-medium text-purple-300">
                      ✓ Free to join &nbsp; ✓ Instant setup &nbsp; ✓ Compete immediately
                    </p>
                    
                    <div className="space-y-3">
                      <Button
                        size="lg"
                        onClick={handleGoogleSignIn}
                        disabled={googleLoading}
                        className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold h-12 rounded-lg transition-all"
                      >
                        {googleLoading ? (
                          <>
                            <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                            Signing up...
                          </>
                        ) : (
                          <>
                            <span className="inline-flex h-4 w-4 rounded-full bg-white text-black font-bold items-center justify-center text-[8px] mr-2">G</span>
                            Sign up with Google
                          </>
                        )}
                      </Button>
                      <Button
                        asChild
                        size="lg"
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90 text-white font-semibold h-12 rounded-lg"
                      >
                        <Link to="/register">
                          Create Account with Email
                          <ChevronRight className="ml-2 w-4 h-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════════
          FINAL CTA SECTION - Premium closing (hidden for authenticated users)
          ═══════════════════════════════════════════════════════════════════════════════ */}
      {!isAuthenticated && (
      <section className="py-20 sm:py-28 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-purple-500/8 via-transparent to-transparent rounded-full" />
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl mx-auto"
          >
            <div className="relative p-8 sm:p-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-xl overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl" />
              
              <div className="relative z-10 text-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.15 }}
                  className="w-16 h-16 mx-auto mb-6 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 p-4 shadow-lg shadow-purple-500/25"
                >
                  <Gem className="w-8 h-8 text-white" />
                </motion.div>

                <h2 className="font-orbitron text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
                  Your Legacy{' '}
                  <span className="gradient-text">Starts Here</span>
                </h2>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  Join Nigeria's best mobile gamers. Build your reputation. Claim your victories.
                </p>

                <Button
                  asChild
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90 text-white font-semibold px-8 h-12 rounded-lg shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-300"
                >
                  <Link to="/register">
                    Create Free Account
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      )}
    </div>
  );
}