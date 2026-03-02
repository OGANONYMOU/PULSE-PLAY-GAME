import { motion } from 'framer-motion';

interface StatCardProps {
  value: string;
  label: string;
  delay?: number;
}

export function StatCard({ value, label, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="gaming-card p-6 text-center group"
    >
      <div className="relative">
        <motion.div
          className="font-orbitron text-3xl md:text-4xl font-bold gradient-text mb-2"
          whileHover={{ scale: 1.05 }}
        >
          {value}
        </motion.div>
        <p className="text-muted-foreground text-sm uppercase tracking-wider">
          {label}
        </p>
      </div>
      
      {/* Glow Effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-cyan-500/10 group-hover:via-purple-500/10 group-hover:to-pink-500/10 transition-all duration-500" />
    </motion.div>
  );
}
