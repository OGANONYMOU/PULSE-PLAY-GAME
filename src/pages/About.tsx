import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Trophy, DollarSign, Gamepad2, Users, Check, ArrowRight, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrency } from '@/contexts/CurrencyContext';




const features = [
  {
    icon: Trophy,
    title: 'Weekly Tournaments',
    description: 'Compete every week across multiple games',
  },
  {
    icon: DollarSign,
    title: 'Real Cash Prizes',
    description: 'Win and get paid directly',
  },
  {
    icon: Gamepad2,
    title: 'Your Favourite Games',
    description: 'CODM, eFootball, Free Fire & more',
  },
];

const values = [
  {
    icon: '🌍',
    title: 'Community First',
    description: 'Every feature we build starts with what\'s best for the players and tournament organizers in our community.',
    featured: false,
  },
  {
    icon: '⚡',
    title: 'Built for Growth',
    description: 'Scalable brackets, real-time leaderboards, and transparent rules make every competition fair and exciting.',
    featured: true,
  },
  {
    icon: '🔒',
    title: 'Secure & Transparent',
    description: 'We protect player data and keep prize distribution fully transparent — no hidden fees, no surprises.',
    featured: false,
  },
];

const timeline = [
  {
    year: '2024',
    title: 'PulsePay Founded',
    description: 'A small team of mobile gaming enthusiasts launched PulsePay with a single goal: make competitive mobile gaming accessible to everyone.',
  },
  {
    year: 'Early 2025',
    title: 'First 1,000 Players',
    description: 'We hit our first milestone — 1,000 registered players and our inaugural tournament series across CODM and eFootball.',
  },
  {
    year: 'Mid 2025',
    title: 'Prize Distribution Launched',
    description: 'Players earned real cash through PulsePay tournaments, proving that mobile gaming can be a legitimate competitive pursuit.',
  },
  {
    year: 'Now',
    title: '10K+ Gamers & Growing',
    description: 'With over 10,000 active players, 50+ tournaments, and a thriving community, PulsePay is just getting started.',
    current: true,
  },
];

export function About() {
  const { symbol } = useCurrency();

  const stats = [
    { value: '10K+',      label: 'Active Gamers',       icon: Users },
    { value: '50+',       label: 'Tournaments Hosted',   icon: Trophy },
    { value: symbol + '0', label: 'Total Prize Pool',    icon: DollarSign },
    { value: '15+',       label: 'Partner Games',        icon: Gamepad2 },
  ];
  return (
    <div className="min-h-screen pt-24">
      {/* Hero Section */}
      <section className="relative px-6 py-20 overflow-hidden">
        {/* Background Orbs */}
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="max-w-7xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-sm font-medium mb-6">
              Empowering Mobile Gamers Since 2024
            </div>
            <h1 className="font-orbitron text-5xl md:text-6xl font-bold mb-6">
              We Live &<br />
              <span className="gradient-text">Breathe Gaming</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-10">
              PulsePay is the home of competitive mobile gaming in Nigeria and beyond. 
              We build community-first experiences for players who are hungry to compete, connect, and win.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-cyan-500 to-purple-600"
              >
                <Link to="/register">
                  Join PulsePay
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-purple-500/50"
              >
                <Link to="/tournaments">View Tournaments</Link>
              </Button>
            </div>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="gaming-card p-6 text-center"
              >
                <stat.icon className="w-8 h-8 mx-auto mb-3 text-cyan-400" />
                <div className="font-orbitron text-2xl md:text-3xl font-bold gradient-text">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Text */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-4">
                Our Purpose
              </div>
              <h2 className="font-orbitron text-3xl md:text-4xl font-bold mb-6">
                Built for Players,<br />By Players
              </h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                PulsePay was founded by mobile gamers who were frustrated with the lack of 
                structured competition and community on mobile platforms. We set out to change that.
              </p>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                Today we organize high-stakes tournaments, surface player highlights, and create 
                real opportunities for players of all skill levels to compete, grow, and earn recognition.
              </p>

              {/* Highlights */}
              <div className="space-y-3">
                {[
                  'Fair, transparent prize distribution',
                  'Open to all skill levels',
                  'Community-driven game selection',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-4 h-4 text-green-500" />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Feature Cards */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="space-y-4">
                {features.map((feature, idx) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 * idx }}
                    className="gaming-card p-6 flex items-center gap-4"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                      <feature.icon className="w-7 h-7 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="font-orbitron font-bold text-lg">{feature.title}</h3>
                      <p className="text-muted-foreground text-sm">{feature.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 via-transparent to-cyan-500/5" />
        
        <div className="max-w-7xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-4">
              Why PulsePay?
            </div>
            <h2 className="font-orbitron text-3xl md:text-4xl font-bold">
              Built on Three Pillars
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((value, idx) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 * idx }}
                className={`gaming-card p-8 text-center ${value.featured ? 'border-cyan-500/50' : ''}`}
              >
                <div className="text-5xl mb-6">{value.icon}</div>
                <h3 className="font-orbitron text-xl font-bold mb-4">{value.title}</h3>
                <p className="text-muted-foreground">{value.description}</p>
                {value.featured && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 -z-10" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-4">
              Our Journey
            </div>
            <h2 className="font-orbitron text-3xl md:text-4xl font-bold">
              How We Got Here
            </h2>
          </motion.div>

          <div className="relative">
            {/* Line */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500 via-purple-500 to-pink-500" />

            {timeline.map((item, idx) => (
              <motion.div
                key={item.year}
                initial={{ opacity: 0, x: idx % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 * idx }}
                className={`relative flex items-start gap-8 mb-12 ${
                  idx % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                {/* Dot */}
                <div className={`absolute left-4 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full ${
                  item.current 
                    ? 'bg-cyan-500 ring-4 ring-cyan-500/30' 
                    : 'bg-purple-500'
                }`} />

                {/* Content */}
                <div className={`ml-12 md:ml-0 md:w-1/2 ${
                  idx % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12'
                }`}>
                  <div className="gaming-card p-6 inline-block">
                    <div className="text-cyan-400 font-bold text-sm mb-2">{item.year}</div>
                    <h3 className="font-orbitron text-lg font-bold mb-2">{item.title}</h3>
                    <p className="text-muted-foreground text-sm">{item.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="gaming-card p-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />

            <div className="relative z-10">
              <h2 className="font-orbitron text-3xl md:text-4xl font-bold mb-4">
                Ready to Compete?
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                Join thousands of players already on PulsePay. Sign up free and enter your first tournament today.
              </p>
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-pink-500 mb-8"
              >
                <Link to="/register">
                  Create Free Account
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground">
                <a href="mailto:support@pulsepay.com" className="flex items-center gap-2 hover:text-cyan-400 transition-colors">
                  <Mail className="w-4 h-4" />
                  support@pulsepay.com
                </a>
                <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-cyan-400 transition-colors">
                  <MessageCircle className="w-4 h-4" />
                  Join our Discord
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}