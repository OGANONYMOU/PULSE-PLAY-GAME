import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Trophy, DollarSign, Gamepad2, Users, Check, ArrowRight, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AboutSEO } from '@/components/SEO';
import { getPlatformStats, type PlatformStats } from '@/lib/platformStats';

const features = [
  { icon: Trophy,      title: 'Weekly Tournaments', description: 'Compete every week across multiple games' },
  { icon: DollarSign,  title: 'Real Cash Prizes',   description: 'Win and get paid directly' },
  { icon: Gamepad2,    title: 'Your Favourite Games', description: 'CODM, eFootball, Free Fire & more' },
];

const values = [
  {
    icon: '🌍', title: 'Community First',
    description: "Every feature we build starts with what's best for the players and tournament organizers in our community.",
    featured: false,
  },
  {
    icon: '⚡', title: 'Built for Growth',
    description: 'Scalable brackets, real-time leaderboards, and transparent rules make every competition fair and exciting.',
    featured: true,
  },
  {
    icon: '🔒', title: 'Secure & Transparent',
    description: 'We protect player data and keep prize distribution fully transparent — no hidden fees, no surprises.',
    featured: false,
  },
];

const timeline = [
  { year: '2024',      title: 'PulsePlay Founded',       description: 'A small team of mobile gaming enthusiasts launched PulsePlay with a single goal: make competitive mobile gaming accessible to everyone.', current: false },
  { year: 'Early 2025', title: 'First Tournament Series', description: 'Our inaugural tournament series went live across CODM and eFootball, kicking off a growing player community.', current: false },
  { year: 'Mid 2025',  title: 'Real Cash Prizes',         description: 'Players started earning real cash through PulsePlay tournaments, proving mobile gaming can be a legitimate competitive pursuit.', current: false },
  { year: 'Now',       title: 'Growing Every Week',        description: 'With an active and growing community across multiple games, PulsePlay is just getting started.', current: true },
];

export function About() {
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  useEffect(() => { getPlatformStats().then(setPlatformStats); }, []);

  const stats = [
    { value: platformStats ? `${platformStats.activeGamers.toLocaleString()}+` : '—', label: 'Active Gamers',      icon: Users },
    { value: platformStats ? `${platformStats.tournamentsHosted.toLocaleString()}+` : '—', label: 'Tournaments Hosted', icon: Trophy },
    { value: platformStats ? `₦${platformStats.totalPrizePool.toLocaleString()}` : '—', label: 'Total Prize Pool',   icon: DollarSign },
    { value: platformStats ? `${platformStats.partnerGames}+` : '—', label: 'Partner Games',      icon: Gamepad2 },
  ];

  return (
    <div className="min-h-screen pt-20 sm:pt-24 overflow-x-hidden">
      <AboutSEO />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-20 overflow-hidden">
        {/* Ambient blobs — clipped to section */}
        <div className="absolute top-10 left-0 w-48 sm:w-64 h-48 sm:h-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-0 w-56 sm:w-80 h-56 sm:h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center mb-12 sm:mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-xs sm:text-sm font-medium mb-5 sm:mb-6">
              Empowering Mobile Gamers Since 2024
            </div>
            <h1 className="font-orbitron text-3xl xs:text-4xl sm:text-5xl md:text-6xl font-bold mb-5 leading-tight">
              We Live &amp;<br />
              <span className="gradient-text">Breathe Gaming</span>
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-xl sm:max-w-2xl mx-auto mb-8 px-2">
              PulsePlay is the home of competitive mobile gaming in Nigeria and beyond.
              We build community-first experiences for players who are hungry to compete, connect, and win.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center px-4 sm:px-0">
              <Button asChild size="lg" className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold h-12 px-6">
                <Link to="/register">
                  Join PulsePlay<ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-purple-500/50 hover:bg-purple-500/10 h-12 px-6">
                <Link to="/tournaments">View Tournaments</Link>
              </Button>
            </div>
          </motion.div>

          {/* Stats grid */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4"
          >
            {stats.map((s) => (
              <div key={s.label} className="gaming-card p-4 sm:p-6 text-center">
                <s.icon className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 sm:mb-3 text-cyan-400" />
                <div className="font-orbitron text-xl sm:text-2xl md:text-3xl font-bold gradient-text">{s.value}</div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-tight">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Mission ──────────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              <div className="text-cyan-400 text-xs sm:text-sm font-bold uppercase tracking-wider mb-3 sm:mb-4">Our Purpose</div>
              <h2 className="font-orbitron text-2xl sm:text-3xl md:text-4xl font-bold mb-5 leading-tight">
                Built for Players,<br />By Players
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base mb-5 leading-relaxed">
                PulsePlay was founded by mobile gamers who were frustrated with the lack of structured competition and community on mobile platforms. We set out to change that.
              </p>
              <p className="text-muted-foreground text-sm sm:text-base mb-7 leading-relaxed">
                Today we organize high-stakes tournaments, surface player highlights, and create real opportunities for players of all skill levels to compete, grow, and earn recognition.
              </p>
              <div className="space-y-2.5 sm:space-y-3">
                {[
                  'Fair, transparent prize distribution',
                  'Open to all skill levels',
                  'Community-driven game selection',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                    </div>
                    <span className="text-sm sm:text-base">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.15 }}
              className="space-y-3 sm:space-y-4"
            >
              {features.map((f, i) => (
                <div key={f.title} className="gaming-card p-4 sm:p-5 flex items-start gap-4">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    i === 0 ? 'bg-cyan-500/20' : i === 1 ? 'bg-purple-500/20' : 'bg-pink-500/20'
                  }`}>
                    <f.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${
                      i === 0 ? 'text-cyan-400' : i === 1 ? 'text-purple-400' : 'text-pink-400'
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-orbitron font-bold text-sm sm:text-base mb-1">{f.title}</h3>
                    <p className="text-muted-foreground text-xs sm:text-sm">{f.description}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Values ───────────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-cyan-500/5 pointer-events-none" />
        <div className="max-w-5xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10 sm:mb-14"
          >
            <h2 className="section-title mb-3">Our Values</h2>
            <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
              The principles that guide every decision we make
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`gaming-card p-5 sm:p-6 text-center ${v.featured ? 'ring-1 ring-cyan-500/40' : ''}`}
              >
                <div className="text-3xl sm:text-4xl mb-3">{v.icon}</div>
                <h3 className="font-orbitron font-bold text-sm sm:text-base mb-2">{v.title}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{v.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Timeline ─────────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10 sm:mb-14"
          >
            <h2 className="section-title mb-3">Our Journey</h2>
            <p className="text-muted-foreground text-sm sm:text-base">From idea to Nigeria's premier gaming platform</p>
          </motion.div>

          <div className="relative">
            {/* Vertical line — hidden on very small screens */}
            <div className="absolute left-4 sm:left-1/2 sm:-translate-x-px top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/40 via-purple-500/30 to-transparent" />

            <div className="space-y-8 sm:space-y-10">
              {timeline.map((item, i) => (
                <motion.div
                  key={item.year}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className={`relative flex items-start gap-4 sm:gap-0 ${
                    i % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'
                  }`}
                >
                  {/* Dot */}
                  <div className="relative z-10 flex-shrink-0 sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:top-3">
                    <div className={`w-3 h-3 rounded-full border-2 ${
                      item.current
                        ? 'bg-cyan-400 border-cyan-400 shadow-glow'
                        : 'bg-background border-white/30'
                    }`} />
                  </div>

                  {/* Content */}
                  <div className={`flex-1 ml-6 sm:ml-0 ${
                    i % 2 === 0 ? 'sm:pr-12 sm:text-right' : 'sm:pl-12'
                  }`}>
                    <div className="gaming-card p-4 sm:p-5">
                      <div className={`text-xs font-mono font-bold mb-1 ${item.current ? 'text-cyan-400' : 'text-purple-400'}`}>
                        {item.year}
                      </div>
                      <h3 className="font-orbitron font-bold text-sm sm:text-base mb-2">{item.title}</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact CTA ──────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="gaming-card p-7 sm:p-10 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/8 via-purple-500/8 to-pink-500/8 pointer-events-none" />
            <div className="relative z-10">
              <h2 className="font-orbitron text-2xl sm:text-3xl font-bold mb-3">Get in Touch</h2>
              <p className="text-muted-foreground text-sm sm:text-base mb-7 max-w-md mx-auto">
                Questions? Partnerships? We'd love to hear from you.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold gap-2 h-11 px-6">
                  <a href="mailto:hello@pulseplay.gg">
                    <Mail className="w-4 h-4" />Email Us
                  </a>
                </Button>
                <Button asChild variant="outline" className="border-purple-500/40 hover:bg-purple-500/10 gap-2 h-11 px-6">
                  <a href="https://discord.com" target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-4 h-4" />Discord
                  </a>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  );
}