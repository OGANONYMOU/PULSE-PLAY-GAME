import React, { Suspense, lazy, useEffect } from 'react';
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

// ── Lazy pages ────────────────────────────────────────────────────────────────
const Home         = lazy(() => import('@/pages/Home').then(m => ({ default: m.Home })));
const Games        = lazy(() => import('@/pages/Games').then(m => ({ default: m.Games })));
const Tournaments  = lazy(() => import('@/pages/Tournaments').then(m => ({ default: m.Tournaments })));
const TournamentCreate = lazy(() => import('@/pages/TournamentCreateNew').then(m => ({ default: m.TournamentCreateNew })));
const Community    = lazy(() => import('@/pages/Community').then(m => ({ default: m.Community })));
const About        = lazy(() => import('@/pages/About').then(m => ({ default: m.About })));
const SignIn       = lazy(() => import('@/pages/SignIn').then(m => ({ default: m.SignIn })));
const Register     = lazy(() => import('@/pages/Register').then(m => ({ default: m.Register })));
const AuthCallback = lazy(() => import('@/pages/AuthCallback').then(m => ({ default: m.AuthCallback })));
const Profile      = lazy(() => import('@/pages/Profile').then(m => ({ default: m.Profile })));
const NotFound     = lazy(() => import('@/pages/NotFound').then(m => ({ default: m.NotFound })));

// ── Admin chunk ───────────────────────────────────────────────────────────────
const AdminLayout        = lazy(() => import('@/pages/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminDashboard     = lazy(() => import('@/pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminUsers         = lazy(() => import('@/pages/admin/AdminUsers').then(m => ({ default: m.AdminUsers })));
const AdminGames         = lazy(() => import('@/pages/admin/AdminGames').then(m => ({ default: m.AdminGames })));
const AdminTournaments   = lazy(() => import('@/pages/admin/AdminTournaments').then(m => ({ default: m.AdminTournaments })));
const AdminPosts         = lazy(() => import('@/pages/admin/AdminPosts').then(m => ({ default: m.AdminPosts })));
const AdminAnnouncements = lazy(() => import('@/pages/admin/AdminAnnouncements').then(m => ({ default: m.AdminAnnouncements })));
const AdminAnalytics     = lazy(() => import('@/pages/admin/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })));
const AdminSettings      = lazy(() => import('@/pages/admin/AdminSettings').then(m => ({ default: m.AdminSettings })));
const AdminAuditLog      = lazy(() => import('@/pages/admin/AdminAuditLog').then(m => ({ default: m.AdminAuditLog })));
const AdminLoyalty       = lazy(() => import('@/pages/admin/AdminLoyalty').then(m => ({ default: m.AdminLoyalty })));
const AdminOrganizers    = lazy(() => import('@/pages/admin/AdminOrganizers').then(m => ({ default: m.AdminOrganizers })));
const AdminPermissions   = lazy(() => import('@/pages/admin/AdminPermissions').then(m => ({ default: m.AdminPermissions })));

// ── Route prefetching ──────────────────────────────────────────────────────────
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


// ── Skeleton ──────────────────────────────────────────────────────────────────
function PageSkeleton(): React.ReactElement {
  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="h-8 w-48 rounded-2xl bg-white/5 animate-pulse mb-3" />
        <div className="h-4 w-72 rounded-xl bg-white/5 animate-pulse mb-10" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-white/5 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page transition ───────────────────────────────────────────────────────────
function PageTransition({ children }: { children: React.ReactNode }): React.ReactElement {
  const { pathname } = useLocation();
  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.14, ease: 'easeOut' }}
        style={{ willChange: 'opacity, transform' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ── Background prefetch ───────────────────────────────────────────────────────
function PrefetchCritical(): null {
  useEffect(() => {
    const t = setTimeout(() => {
      import('@/pages/Home');
      import('@/pages/Games');
      import('@/pages/Tournaments');
      import('@/pages/Community');
    }, 200);
    return () => clearTimeout(t);
  }, []);
  return null;
}

// ── App shell ─────────────────────────────────────────────────────────────────
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
            <Routes location={location}>
              {/* Public */}
              <Route path="/"                  element={<Home />} />
              <Route path="/games"             element={<Games />} />
              <Route path="/tournaments"         element={<Tournaments />} />
              <Route path="/tournaments/create"  element={<TournamentCreate />} />
              <Route path="/community"         element={<Community />} />
              <Route path="/about"             element={<About />} />
              <Route path="/signin"            element={<SignIn />} />
              <Route path="/register"          element={<Register />} />
              <Route path="/auth/callback"     element={<AuthCallback />} />
              <Route path="/profile"           element={<Profile />} />
              <Route path="/profile/:username" element={<Profile />} />

              {/* Admin — nested layout */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index                      element={<AdminDashboard />} />
                <Route path="analytics"           element={<AdminAnalytics />} />
                <Route path="users"               element={<AdminUsers />} />
                <Route path="games"               element={<AdminGames />} />
                <Route path="tournaments"         element={<AdminTournaments />} />
                <Route path="organizers"          element={<AdminOrganizers />} />
                <Route path="permissions"         element={<AdminPermissions />} />
                <Route path="posts"               element={<AdminPosts />} />
                <Route path="announcements"       element={<AdminAnnouncements />} />
                <Route path="settings"            element={<AdminSettings />} />
                <Route path="audit"               element={<AdminAuditLog />} />
                <Route path="loyalty"             element={<AdminLoyalty />} />
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
          <PrefetchCritical />
          <AppContent />
          <Toaster richColors closeButton position="top-right" />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;