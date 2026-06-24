import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, FileText } from 'lucide-react';

export function Terms() {
  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 relative">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-5" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
            <FileText className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="font-orbitron text-4xl sm:text-5xl font-black text-white mb-4 uppercase tracking-wider">
            Terms of Service
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Last Updated: June 24, 2026. Please read these terms carefully before participating in PulsePlay tournaments.
          </p>
        </motion.div>

        <div className="space-y-8 text-slate-300">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using the PulsePlay platform, registering for an account, or participating in any tournament, you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not access or use the platform.
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>
              PulsePlay is designed for users across Africa. You must be at least 13 years of age to use the platform. If you are under 18, you must have permission from a parent or legal guardian to participate in tournaments with monetary prizes. You must also comply with all local laws regarding competitive gaming and prize eligibility in your jurisdiction (e.g., Nigeria, Kenya, South Africa).
            </p>
          </Section>

          <Section title="3. Accounts and Security">
            <p>
              You are responsible for safeguarding the password that you use to access the service and for any activities or actions under your password. PulsePlay reserves the right to suspend or terminate accounts that violate our community guidelines, engage in fraud, or attempt to manipulate tournament results.
            </p>
          </Section>

          <Section title="4. Tournament Rules and Disputes">
            <ul className="list-disc pl-5 space-y-2">
              <li>All participants must adhere to the specific rules of each tournament they enter.</li>
              <li>In the event of a dispute, players must submit valid evidence (e.g., screenshots or video recordings of the final score).</li>
              <li>Admins or our automated dispute resolution system will review evidence. All decisions made by PulsePlay administrators regarding match outcomes are final.</li>
              <li>False reporting or submitting doctored evidence will result in an immediate and permanent ban.</li>
            </ul>
          </Section>

          <Section title="5. Payouts and Withdrawals">
            <p>
              Prize pools are distributed according to the tournament's specific payout structure. Withdrawals are processed via our local fintech partners (such as Paystack or Flutterwave). You must provide accurate banking or mobile money details. PulsePlay is not responsible for delayed payouts due to incorrect information provided by the user.
            </p>
          </Section>

          <Section title="6. Community Guidelines">
            <p>
              We maintain a zero-tolerance policy for hate speech, harassment, severe toxicity, and cheating. Violation of these guidelines in the forums, during matches, or in tournament chats will result in disciplinary action up to account termination and forfeiture of winnings.
            </p>
          </Section>

          <Section title="7. Limitation of Liability">
            <p>
              PulsePlay is provided "as is". We are not liable for any losses, damages, or issues arising from server downtime, game updates, or third-party disruptions (e.g., internet outages or payment gateway failures).
            </p>
          </Section>
        </div>

        <div className="mt-12 text-center text-slate-500 text-sm">
          If you have any questions about these Terms, please contact support@pulseplay.gg
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
