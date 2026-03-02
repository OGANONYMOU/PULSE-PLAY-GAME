import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Gamepad2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // The session will be automatically handled by Supabase auth
    // We just need to wait a moment and then redirect
    const timer = setTimeout(() => {
      toast({
        title: 'Welcome!',
        description: 'You have successfully signed in.',
      });
      navigate('/');
    }, 1500);

    return () => clearTimeout(timer);
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="gaming-card p-12 text-center max-w-md w-full"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center mx-auto mb-6">
          <Gamepad2 className="w-8 h-8 text-white" />
        </div>
        <div className="font-orbitron text-xl font-bold gradient-text mb-2">
          PulsePay
        </div>
        <div className="flex items-center justify-center gap-3 mb-4">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
        <h2 className="text-xl font-bold mb-2">Completing Sign In...</h2>
        <p className="text-muted-foreground">
          Please wait while we authenticate you.
        </p>
      </motion.div>
    </div>
  );
}
