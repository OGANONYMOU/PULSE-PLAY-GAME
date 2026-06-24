import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ChevronRight } from 'lucide-react';

export function Privacy() {
  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 relative">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-5" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
            <ShieldCheck className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="font-orbitron text-4xl sm:text-5xl font-black text-white mb-4 uppercase tracking-wider">
            Privacy Policy
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Last Updated: June 24, 2026. Your privacy and data security are our top priorities.
          </p>
        </motion.div>

        <div className="space-y-8 text-slate-300">
          <Section title="1. Information We Collect">
            <p className="mb-4">We collect information to provide better services to our users. This includes:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Account Information:</strong> Username, email address, password (hashed), and optional profile details.</li>
              <li><strong>Gaming Data:</strong> In-game usernames, match statistics, tournament history, and uploaded clips.</li>
              <li><strong>Payment Information:</strong> For prize payouts, we collect necessary banking or mobile money details. We do not store full credit card numbers; transactions are processed securely by our partners (e.g., Paystack).</li>
              <li><strong>Device & Usage Data:</strong> IP addresses, browser types, and interaction metrics to improve our platform and detect fraud.</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc pl-5 space-y-2">
              <li>To create and manage your PulsePlay account.</li>
              <li>To organize tournaments, generate brackets, and process match disputes.</li>
              <li>To process payouts for tournament winnings securely.</li>
              <li>To communicate with you regarding updates, security alerts, and support messages.</li>
              <li>To enforce our Terms of Service and prevent cheating or fraudulent activity.</li>
            </ul>
          </Section>

          <Section title="3. Information Sharing">
            <p>
              We do not sell your personal data. We may share information with trusted third-party service providers (like Payment Processors or Hosting providers like Supabase) solely for the purpose of operating our platform. We may also disclose information if required by law or to protect the safety and rights of PulsePlay and our users.
            </p>
          </Section>

          <Section title="4. Data Security">
            <p>
              We implement industry-standard security measures, including encryption and Row Level Security (RLS) in our database, to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
            </p>
          </Section>

          <Section title="5. Your Rights">
            <p>
              Depending on your jurisdiction, you may have the right to access, correct, or delete your personal data. You can manage your profile information directly in the PulsePlay app, or contact us to request full account deletion.
            </p>
          </Section>

          <Section title="6. Cookies">
            <p>
              PulsePlay uses cookies to maintain your session, remember your preferences, and analyze site traffic. You can control cookie preferences through your browser settings, but disabling cookies may limit your ability to use certain features of the platform.
            </p>
          </Section>

          <Section title="7. Contact Us">
            <p>
              If you have any questions or concerns about this Privacy Policy or our data practices, please contact our Data Protection Officer at privacy@pulseplay.gg.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="p-6 sm:p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-colors"
    >
      <h2 className="font-orbitron text-xl font-bold text-white mb-4 flex items-center gap-2">
        <ChevronRight className="w-5 h-5 text-cyan-400" />
        {title}
      </h2>
      <div className="text-slate-400 leading-relaxed">
        {children}
      </div>
    </motion.section>
  );
}
