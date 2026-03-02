import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ParticleBackground } from '@/components/ui-custom/ParticleBackground';
import { Toaster } from '@/components/ui/sonner';

import { Home } from '@/pages/Home';
import { Games } from '@/pages/Games';
import { Tournaments } from '@/pages/Tournaments';
import { Community } from '@/pages/Community';
import { About } from '@/pages/About';
import { SignIn } from '@/pages/SignIn';
import { Register } from '@/pages/Register';
import { AuthCallback } from '@/pages/AuthCallback';
import { Profile } from '@/pages/Profile';

import { AdminLayout } from '@/pages/admin/AdminLayout';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminGames } from '@/pages/admin/AdminGames';
import { AdminTournaments } from '@/pages/admin/AdminTournaments';
import { AdminUsers } from '@/pages/admin/AdminUsers';
import { AdminPosts } from '@/pages/admin/AdminPosts';
import { AdminAnnouncements } from '@/pages/admin/AdminAnnouncements';
import { AdminSettings } from '@/pages/admin/AdminSettings';

function PublicLayout() {
  return (
    <div className="relative min-h-screen">
      <ParticleBackground />
      <Navbar />
      <main className="relative z-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/games" element={<Games />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route path="/community" element={<Community />} />
          <Route path="/about" element={<About />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="games" element={<AdminGames />} />
              <Route path="tournaments" element={<AdminTournaments />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="posts" element={<AdminPosts />} />
              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
            <Route path="/*" element={<PublicLayout />} />
          </Routes>
        </Router>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;