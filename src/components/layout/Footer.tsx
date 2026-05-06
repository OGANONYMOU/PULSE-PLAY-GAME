import { Link } from 'react-router-dom';
import { Gamepad2, Twitter, Instagram, MessageCircle, Github } from 'lucide-react';

const socialLinks = [
  { href: 'https://twitter.com', icon: Twitter,       label: 'Twitter' },
  { href: 'https://instagram.com', icon: Instagram,   label: 'Instagram' },
  { href: 'https://discord.com', icon: MessageCircle, label: 'Discord' },
  { href: 'https://github.com', icon: Github,         label: 'Github' },
];

const footerLinks = [
  {
    title: 'Platform',
    links: [
      { label: 'Games',       href: '/games' },
      { label: 'Tournaments', href: '/tournaments' },
      { label: 'Community',   href: '/community' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Clips',    href: '/clips' },
      { label: 'Clubs',    href: '/clubs' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/about' },
      { label: 'Privacy Policy',   href: '/about' },
      { label: 'Contact Us',       href: '/about' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative mt-16 sm:mt-20 border-t border-border/50">
      <div className="absolute inset-0 bg-gradient-to-t from-purple-500/5 to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 relative">
        {/* Main grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-10">

          {/* Brand — full width on mobile, 2 cols on lg */}
          <div className="col-span-2 lg:col-span-2">
            <Link to="/" className="inline-flex items-center gap-3 group mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Gamepad2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-orbitron text-lg font-bold gradient-text">PulsePlay</span>
            </Link>
            <p className="text-muted-foreground text-sm max-w-xs mb-5 leading-relaxed">
              Nigeria's ultimate mobile gaming community. Compete in tournaments, connect with players, and win real prizes.
            </p>
            <div className="flex gap-2 flex-wrap">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                >
                  <s.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns — each takes 1 col, wrapping naturally on mobile */}
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h3 className="font-orbitron font-bold text-xs uppercase tracking-wider mb-3 text-foreground">
                {section.title}
              </h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-muted-foreground text-sm hover:text-cyan-400 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 sm:mt-12 pt-6 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs sm:text-sm text-center sm:text-left">
            © {new Date().getFullYear()} PulsePlay. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  );
}