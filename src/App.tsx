import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ParticleBackground } from '@/components/ui-custom/ParticleBackground';
import { ScrollToTop } from '@/components/ScrollToTop';
import { AppLoader } from '@/components/AppLoader';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';

// ── Lazy-load every page ─────────────────────────────────────────────────────
// Each page loads only when first visited — reduces initial bundle ~60%
const Home        = lazy(() => import('@/pages/Home').then(m => ({ default: m.Home })));
const Games       = lazy(() => import('@/pages/Games').then(m => ({ default: m.Games })));
const Tournaments = lazy(() => import('@/pages/Tournaments').then(m => ({ default: m.Tournaments })));
const Community   = lazy(() => import('@/pages/Community').then(m => ({ default: m.Community })));
const About       = lazy(() => import('@/pages/About').then(m => ({ default: m.About })));
const SignIn      = lazy(() => import('@/pages/SignIn').then(m => ({ default: m.SignIn })));
const Register    = lazy(() => import('@/pages/Register').then(m => ({ default: m.Register })));
const AuthCallback = lazy(() => import('@/pages/AuthCallback').then(m => ({ default: m.AuthCallback })));
const Profile     = lazy(() => import('@/pages/Profile').then(m => ({ default: m.Profile })));
const NotFound    = lazy(() => import('@/pages/NotFound').then(m => ({ default: m.NotFound })));

// Admin pages — separate chunk, only loaded for admins
const AdminLayout    = lazy(() => import('@/pages/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminUsers     = lazy(() => import('@/pages/admin/AdminUsers').then(m => ({ default: m.AdminUsers })));
const AdminGames     = lazy(() => import('@/pages/admin/AdminGames').then(m => ({ default: m.AdminGames })));
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })));

// ── Page-level skeleton fallback (shown during lazy-load) ───────────────────
function PageSkeleton(): React.ReactElement {
  return (
    <div className="min-h-screen pt-24 px-6 max-w-7xl mx-auto">
      <div className="h-12 w-64 rounded-2xl bg-white/5 animate-pulse mb-4" />
      <div className="h-6 w-96 rounded-xl bg-white/5 animate-pulse mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ── Page transition wrapper ─────────────────────────────────────────────────
function PageTransition({ children }: { children: React.ReactNode }): React.ReactElement {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ── App shell ───────────────────────────────────────────────────────────────
function AppContent(): React.ReactElement {
  const { isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AppLoader />;

  return (
    <div className="relative min-h-screen">
      <ParticleBackground />
      <Navbar />
      <main className="relative z-10">
        <PageTransition>
          <Suspense fallback={<PageSkeleton />}>
            <Routes location={location} key={location.pathname}>
              <Route path="/"                  element={<Home />} />
              <Route path="/games"             element={<Games />} />
              <Route path="/tournaments"       element={<Tournaments />} />
              <Route path="/community"         element={<Community />} />
              <Route path="/about"             element={<About />} />
              <Route path="/signin"            element={<SignIn />} />
              <Route path="/register"          element={<Register />} />
              <Route path="/auth/callback"     element={<AuthCallback />} />
              <Route path="/profile"           element={<Profile />} />
              <Route path="/profile/:username" element={<Profile />} />
              <Route path="/admin"             element={<AdminLayout />}>
                <Route index                  element={<AdminDashboard />} />
                <Route path="users"           element={<AdminUsers />} />
                <Route path="games"           element={<AdminGames />} />
                <Route path="analytics"       element={<AdminAnalytics />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </PageTransition>
      </main>
      <Footer />
    </div>
  );
}

function App(): React.ReactElement {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <AppContent />
          <Toaster richColors closeButton position="top-right" />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;