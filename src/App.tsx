import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ParticleBackground } from '@/components/ui-custom/ParticleBackground';
import { ScrollToTop } from '@/components/ScrollToTop';
import { AppLoader } from '@/components/AppLoader';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';

// ── Lazy pages ───────────────────────────────────────────────────────────────
const Home          = lazy(() => import('@/pages/Home').then(m => ({ default: m.Home })));
const Games         = lazy(() => import('@/pages/Games').then(m => ({ default: m.Games })));
const Tournaments   = lazy(() => import('@/pages/Tournaments').then(m => ({ default: m.Tournaments })));
const Community     = lazy(() => import('@/pages/Community').then(m => ({ default: m.Community })));
const About         = lazy(() => import('@/pages/About').then(m => ({ default: m.About })));
const SignIn        = lazy(() => import('@/pages/SignIn').then(m => ({ default: m.SignIn })));
const Register      = lazy(() => import('@/pages/Register').then(m => ({ default: m.Register })));
const AuthCallback  = lazy(() => import('@/pages/AuthCallback').then(m => ({ default: m.AuthCallback })));
const Profile       = lazy(() => import('@/pages/Profile').then(m => ({ default: m.Profile })));
const NotFound      = lazy(() => import('@/pages/NotFound').then(m => ({ default: m.NotFound })));

// Admin chunk — separate bundle
const AdminLayout       = lazy(() => import('@/pages/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminDashboard    = lazy(() => import('@/pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminUsers        = lazy(() => import('@/pages/admin/AdminUsers').then(m => ({ default: m.AdminUsers })));
const AdminGames        = lazy(() => import('@/pages/admin/AdminGames').then(m => ({ default: m.AdminGames })));
const AdminAnalytics    = lazy(() => import('@/pages/admin/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })));
const AdminTournaments  = lazy(() => import('@/pages/admin/AdminTournaments').then(m => ({ default: m.AdminTournaments })));
const AdminPosts        = lazy(() => import('@/pages/admin/AdminPosts').then(m => ({ default: m.AdminPosts })));
const AdminAnnouncements = lazy(() => import('@/pages/admin/AdminAnnouncements').then(m => ({ default: m.AdminAnnouncements })));
const AdminSettings     = lazy(() => import('@/pages/admin/AdminSettings').then(m => ({ default: m.AdminSettings })));

// ── Route prefetching on nav hover ───────────────────────────────────────────
const PREFETCH_MAP: Record<string, () => Promise<unknown>> = {
  '/':            () => import('@/pages/Home'),
  '/games':       () => import('@/pages/Games'),
  '/tournaments': () => import('@/pages/Tournaments'),
  '/community':   () => import('@/pages/Community'),
  '/about':       () => import('@/pages/About'),
  '/signin':      () => import('@/pages/SignIn'),
  '/register':    () => import('@/pages/Register'),
  '/profile':     () => import('@/pages/Profile'),
};
export function prefetchRoute(path: string): void {
  const fn = PREFETCH_MAP[path];
  if (fn) fn();
}

// ── Page skeleton ────────────────────────────────────────────────────────────
function PageSkeleton(): React.ReactElement {
  return (
    <div className="min-h-screen pt-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="h-10 w-56 rounded-2xl bg-white/5 animate-pulse mb-3" />
        <div className="h-5 w-80 rounded-xl bg-white/5 animate-pulse mb-10" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-52 rounded-2xl bg-white/5 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page transition ──────────────────────────────────────────────────────────
function PageTransition({ children }: { children: React.ReactNode }): React.ReactElement {
  const { pathname } = useLocation();
  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12, ease: 'linear' }}
        style={{ willChange: 'opacity' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ── Prefetch critical pages after first load ─────────────────────────────────
function PrefetchCritical(): null {
  useEffect(() => {
    const t = setTimeout(() => {
      import('@/pages/Home');
      import('@/pages/Games');
      import('@/pages/Tournaments');
    }, 800);
    return () => clearTimeout(t);
  }, []);
  return null;
}

// ── App shell ────────────────────────────────────────────────────────────────
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

              {/* Admin — all 8 sub-routes now wired */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index                    element={<AdminDashboard />} />
                <Route path="analytics"         element={<AdminAnalytics />} />
                <Route path="users"             element={<AdminUsers />} />
                <Route path="tournaments"       element={<AdminTournaments />} />
                <Route path="games"             element={<AdminGames />} />
                <Route path="posts"             element={<AdminPosts />} />
                <Route path="announcements"     element={<AdminAnnouncements />} />
                <Route path="settings"          element={<AdminSettings />} />
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
      <CurrencyProvider>
        <AuthProvider>
          <Router>
            <ScrollToTop />
            <PrefetchCritical />
            <AppContent />
            <Toaster richColors closeButton position="top-right" />
          </Router>
        </AuthProvider>
      </CurrencyProvider>
    </ThemeProvider>
  );
}

export default App;