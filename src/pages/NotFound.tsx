import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Frown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotFound(): React.ReactElement {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 pt-24">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md"
      >
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center mx-auto mb-6">
          <Frown className="w-10 h-10 text-white/40" />
        </div>
        <div className="font-orbitron text-7xl font-black gradient-text mb-4">404</div>
        <h1 className="font-orbitron text-2xl font-bold text-white mb-3">Page Not Found</h1>
        <p className="text-white/50 text-sm mb-8 leading-relaxed">
          The page you're looking for doesn't exist or was moved. Head back to the arena.
        </p>
        <Button asChild className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold px-8">
          <Link to="/">
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}