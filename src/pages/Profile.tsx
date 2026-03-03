import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Camera, Edit2, Save, X, Twitter, Trophy,
  Flame, Calendar, MessageSquare, Shield, User,
  ExternalLink, Swords, Star, Zap, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, type Profile as ProfileType } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

type TabId = 'posts' | 'tournaments' | 'achievements';

type PostItem = {
  id: string;
  title: string;
  content: string;
  tag: string;
  likes: number;
  comments: number;
  created_at: string;
};

type EditForm = {
  first_name: string;
  last_name: string;
  bio: string;
  discord_username: string;
  twitter_username: string;
};

function getRoleColor(role: string): string {
  if (role === 'ADMIN') return 'from-red-500 to-pink-500';
  if (role === 'MODERATOR') return 'from-yellow-500 to-orange-500';
  return 'from-cyan-500 to-purple-500';
}

function getRoleBadgeClass(role: string): string {
  if (role === 'ADMIN') return 'bg-red-500/20 text-red-400 border border-red-500/40';
  if (role === 'MODERATOR') return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40';
  return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40';
}

function getTagClass(tag: string): string {
  if (tag === 'general') return 'bg-blue-500/20 text-blue-400';
  if (tag === 'tournament') return 'bg-purple-500/20 text-purple-400';
  if (tag === 'tips') return 'bg-green-500/20 text-green-400';
  if (tag === 'clips') return 'bg-pink-500/20 text-pink-400';
  return 'bg-white/10 text-white/60';
}

// ── Sub-components (single-return ternary, required by this project's strict TS) ──

function AvatarDisplay(p: { url: string | null; username: string; size: string }): React.ReactElement {
  const letter = p.username[0] ? p.username[0].toUpperCase() : 'U';
  return p.url ? (
    <img src={p.url} alt={p.username} className={'rounded-full object-cover w-full h-full'} />
  ) : (
    <div className={'w-full h-full rounded-full flex items-center justify-center bg-gradient-to-br from-cyan-500 to-purple-600 font-orbitron font-bold text-white ' + p.size}>
      {letter}
    </div>
  );
}

function AdminIconBadge(p: { show: boolean }): React.ReactElement {
  return p.show ? <Shield className="w-3 h-3 mr-1 inline" /> : <span />;
}

function PrivateInfo(p: { show: boolean; label: string; value: string | null }): React.ReactElement {
  return p.show && p.value ? (
    <div className="flex items-center gap-2 text-xs text-white/50">
      <span className="text-white/30">{p.label}:</span>
      <span>{p.value}</span>
    </div>
  ) : <span />;
}

function BioText(p: { show: boolean; bio: string | null; isOwn: boolean }): React.ReactElement {
  const text = p.bio || (p.isOwn ? 'No bio yet — click Edit Profile to add one.' : 'No bio yet.');
  return p.show ? (
    <p className="text-white/60 text-sm leading-relaxed mt-3 max-w-2xl">{text}</p>
  ) : <span />;
}

function TwitterBadge(p: { username: string | null }): React.ReactElement {
  const url = 'https://twitter.com/' + (p.username ?? '');
  return p.username ? (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 text-xs text-white/60 hover:text-cyan-400 transition-all">
      <Twitter className="w-3.5 h-3.5" />
      <span>{'@' + p.username}</span>
      <ExternalLink className="w-3 h-3 opacity-50" />
    </a>
  ) : <span />;
}

function DiscordBadge(p: { username: string | null }): React.ReactElement {
  return p.username ? (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
      <MessageSquare className="w-3.5 h-3.5" />
      <span>{p.username}</span>
    </div>
  ) : <span />;
}

function SocialRow(p: { show: boolean; twitter: string | null; discord: string | null }): React.ReactElement {
  return p.show && (p.twitter || p.discord) ? (
    <div className="flex items-center gap-2 mt-4 flex-wrap">
      <TwitterBadge username={p.twitter} />
      <DiscordBadge username={p.discord} />
    </div>
  ) : <span />;
}

function EditBtn(p: { show: boolean; onClick: () => void }): React.ReactElement {
  return p.show ? (
    <Button onClick={p.onClick} size="sm"
      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs h-8">
      <Edit2 className="w-3.5 h-3.5" />
      Edit Profile
    </Button>
  ) : <span />;
}

function BannerImage(p: { url: string | null }): React.ReactElement {
  return p.url ? (
    <img src={p.url} alt="banner" className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full bg-gradient-to-r from-cyan-900/40 via-purple-900/40 to-pink-900/40" />
  );
}

function BannerUpload(p: { show: boolean; uploading: boolean; onClick: () => void }): React.ReactElement {
  return p.show ? (
    <button onClick={p.onClick} disabled={p.uploading}
      className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 border border-white/20 text-white text-xs transition-all">
      <Camera className="w-3.5 h-3.5" />
      {p.uploading ? 'Uploading...' : 'Change Banner'}
    </button>
  ) : <span />;
}

function AvatarUpload(p: { show: boolean; uploading: boolean; onClick: () => void }): React.ReactElement {
  return p.show ? (
    <button onClick={p.onClick} disabled={p.uploading}
      className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-cyan-500 hover:bg-cyan-400 flex items-center justify-center border-2 border-background transition-all">
      <Camera className="w-3.5 h-3.5 text-white" />
    </button>
  ) : <span />;
}

function EditPanel(p: {
  show: boolean;
  form: EditForm;
  saving: boolean;
  onChange: (f: EditForm) => void;
  onSave: () => void;
  onCancel: () => void;
}): React.ReactElement {
  const charCount = p.form.bio.length + '/300';
  return p.show ? (
    <div className="mt-6 p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-orbitron font-bold text-sm text-white">Edit Profile</h3>
        <button onClick={p.onCancel} className="text-white/40 hover:text-white/80 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <Separator className="bg-white/10" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/50 block mb-1.5">First Name</label>
          <Input value={p.form.first_name} onChange={(e) => p.onChange({ ...p.form, first_name: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9 text-sm" placeholder="First name" />
        </div>
        <div>
          <label className="text-xs text-white/50 block mb-1.5">Last Name</label>
          <Input value={p.form.last_name} onChange={(e) => p.onChange({ ...p.form, last_name: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9 text-sm" placeholder="Last name" />
        </div>
      </div>
      <div>
        <label className="text-xs text-white/50 block mb-1.5">Bio</label>
        <Textarea value={p.form.bio} onChange={(e) => p.onChange({ ...p.form, bio: e.target.value })}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none"
          rows={3} placeholder="Tell the community about yourself..." maxLength={300} />
        <span className="text-xs text-white/30 mt-1 block">{charCount}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/50 block mb-1.5">Twitter Username</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">@</span>
            <Input value={p.form.twitter_username} onChange={(e) => p.onChange({ ...p.form, twitter_username: e.target.value })}
              className="pl-7 bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9 text-sm" placeholder="username" />
          </div>
        </div>
        <div>
          <label className="text-xs text-white/50 block mb-1.5">Discord Username</label>
          <Input value={p.form.discord_username} onChange={(e) => p.onChange({ ...p.form, discord_username: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9 text-sm" placeholder="username#0000" />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" size="sm" onClick={p.onCancel} disabled={p.saving}
          className="text-white/60 hover:text-white hover:bg-white/10 h-8 text-xs">
          Cancel
        </Button>
        <Button size="sm" onClick={p.onSave} disabled={p.saving}
          className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white h-8 text-xs font-bold">
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {p.saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  ) : <span />;
}

function TabPosts(p: { active: boolean; posts: PostItem[]; isOwn: boolean }): React.ReactElement {
  return p.active ? (
    <div className="space-y-3">
      {p.posts.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="w-12 h-12 mx-auto text-white/20 mb-3" />
          <p className="text-white/40 text-sm">No posts yet.</p>
          {p.isOwn ? (
            <Button asChild size="sm" className="mt-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
              <Link to="/community">Write your first post</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        p.posts.map((post) => (
          <div key={post.id} className="p-5 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-orbitron font-bold text-sm text-white">{post.title}</h3>
              <span className={'text-xs px-2 py-0.5 rounded-full flex-shrink-0 ' + getTagClass(post.tag)}>{post.tag}</span>
            </div>
            <p className="text-white/50 text-sm mb-3 line-clamp-2">{post.content}</p>
            <div className="flex items-center gap-4 text-xs text-white/40">
              <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" />{post.likes}</span>
              <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{post.comments}</span>
              <span className="ml-auto">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
            </div>
          </div>
        ))
      )}
    </div>
  ) : <span />;
}

function TabTournaments(p: { active: boolean }): React.ReactElement {
  return p.active ? (
    <div className="text-center py-16">
      <Trophy className="w-12 h-12 mx-auto text-white/20 mb-3" />
      <p className="text-white/40 text-sm">No tournament history yet.</p>
    </div>
  ) : <span />;
}

function TabAchievements(p: { active: boolean }): React.ReactElement {
  const achievements = [
    { icon: Star, label: 'First Blood', desc: 'Joined PulsePay', color: 'text-yellow-400', unlocked: true },
    { icon: Trophy, label: 'Champion', desc: 'Win a tournament', color: 'text-purple-400', unlocked: false },
    { icon: Flame, label: 'On Fire', desc: 'Post 10 times', color: 'text-orange-400', unlocked: false },
    { icon: Zap, label: 'Speed Runner', desc: 'First to register', color: 'text-cyan-400', unlocked: false },
  ];
  return p.active ? (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {achievements.map((a) => (
        <div key={a.label} className={'p-4 rounded-xl border text-center transition-all ' + (a.unlocked ? 'bg-white/5 border-white/20' : 'bg-white/2 border-white/5 opacity-40')}>
          <a.icon className={'w-8 h-8 mx-auto mb-2 ' + (a.unlocked ? a.color : 'text-white/20')} />
          <div className="font-orbitron text-xs font-bold text-white mb-1">{a.label}</div>
          <div className="text-xs text-white/40">{a.desc}</div>
        </div>
      ))}
    </div>
  ) : <span />;
}

// ── Main Profile component ──

export function Profile(): React.ReactElement {
  const { username } = useParams<{ username?: string }>();
  const { user, profile: ownProfile, updateProfile, isLoading: authLoading } = useAuth();

  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('posts');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const avatarRef = useRef<HTMLInputElement | null>(null);
  const bannerRef = useRef<HTMLInputElement | null>(null);

  const [editForm, setEditForm] = useState<EditForm>({
    first_name: '', last_name: '', bio: '', discord_username: '', twitter_username: '',
  });

  const isOwnProfile = !username || username === ownProfile?.username;

  useEffect(() => {
    if (authLoading) return;

    const load = async () => {
      setPageLoading(true);
      setFetchError('');
      setNotFound(false);
      let found: ProfileType | null = null;

      try {
        if (isOwnProfile) {
          if (ownProfile) {
            found = ownProfile;
          } else if (user) {
            const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (error && error.code !== 'PGRST116') throw error;
            found = data as ProfileType | null;
          } else {
            // Not logged in, viewing /profile with no username param
            setNotFound(false);
            setPageLoading(false);
            return;
          }
        } else {
          const { data, error } = await supabase.from('profiles').select('*').eq('username', username).single();
          if (error && error.code !== 'PGRST116') throw error;
          found = data as ProfileType | null;
        }

        if (found) {
          setProfile(found);
          setEditForm({
            first_name: found.first_name ?? '',
            last_name: found.last_name ?? '',
            bio: found.bio ?? '',
            discord_username: found.discord_username ?? '',
            twitter_username: found.twitter_username ?? '',
          });
          const { data: postsData } = await supabase
            .from('posts').select('*')
            .eq('author_id', found.id)
            .order('created_at', { ascending: false })
            .limit(20);
          setPosts((postsData as PostItem[]) ?? []);
        } else {
          setNotFound(true);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load profile';
        console.error('[Profile] load error:', msg);
        setFetchError(msg);
      } finally {
        setPageLoading(false);
      }
    };

    load();
  }, [username, ownProfile, user, isOwnProfile, authLoading]); // eslint-disable-line

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await updateProfile(editForm);
    if (error) {
      toast.error('Failed to save: ' + error.message);
    } else {
      toast.success('Profile updated!');
      setProfile((prev) => (prev ? { ...prev, ...editForm } : prev));
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const uploadFile = async (file: File, suffix: string, field: 'avatar_url' | 'banner_url', setUploading: (v: boolean) => void) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = user.id + '/' + suffix + Date.now() + '.' + ext;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) { toast.error('Upload failed: ' + upErr.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = urlData.publicUrl;
    const { error: updErr } = await updateProfile({ [field]: url });
    if (updErr) {
      toast.error('Failed to save image.');
    } else {
      setProfile((prev) => (prev ? { ...prev, [field]: url } : prev));
      toast.success('Image updated!');
    }
    setUploading(false);
  };

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadFile(f, 'avatar', 'avatar_url', setIsUploadingAvatar);
  };

  const onBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadFile(f, 'banner', 'banner_url', setIsUploadingBanner);
  };

  const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'posts', label: 'Posts', icon: MessageSquare },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy },
    { id: 'achievements', label: 'Achievements', icon: Star },
  ];

  // Auth still loading
  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen pt-24">
        <div className="max-w-4xl mx-auto px-6 space-y-4">
          <div className="h-48 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
          <div className="grid grid-cols-4 gap-3">
            <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
          </div>
          <div className="h-64 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-6">
        <div className="text-center p-10 rounded-2xl bg-white/5 border border-white/10 max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="font-orbitron text-xl font-bold text-white mb-2">Failed to Load</h2>
          <p className="text-white/50 text-sm mb-6">{fetchError}</p>
          <Button onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Not logged in and viewing /profile (own profile)
  if (isOwnProfile && !user) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-6">
        <div className="text-center p-10 rounded-2xl bg-white/5 border border-white/10 max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-cyan-400" />
          </div>
          <h2 className="font-orbitron text-2xl font-bold text-white mb-2">Sign In Required</h2>
          <p className="text-white/50 text-sm mb-6">Please sign in to view your profile.</p>
          <Button asChild className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white w-full">
            <Link to="/signin">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-6">
        <div className="text-center p-10 rounded-2xl bg-white/5 border border-white/10 max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-white/40" />
          </div>
          <h2 className="font-orbitron text-2xl font-bold text-white mb-2">Player Not Found</h2>
          <p className="text-white/50 text-sm mb-6">This profile does not exist or has been removed.</p>
          <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
  const joinedDate = format(new Date(profile.created_at), 'MMMM yyyy');
  const roleGradient = getRoleColor(profile.role);
  const roleBadge = getRoleBadgeClass(profile.role);
  const postsTitle = isOwnProfile ? 'My Posts' : profile.username + "'s Posts";

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">

        {/* Banner */}
        <div className="relative h-44 sm:h-56 rounded-2xl overflow-hidden mb-0">
          <BannerImage url={profile.banner_url} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <BannerUpload show={isOwnProfile} uploading={isUploadingBanner} onClick={() => bannerRef.current?.click()} />
          <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={onBannerChange} />
        </div>

        {/* Profile Header Card */}
        <div className="relative -mt-16 mx-2 sm:mx-0 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 sm:p-6 mb-4">
          <div className="flex flex-col sm:flex-row items-start gap-5">

            {/* Avatar */}
            <div className="relative flex-shrink-0 -mt-14 sm:-mt-16">
              <div className={'w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-black/40 ring-2 ring-gradient-to-r ' + roleGradient + ' ring-offset-0'}>
                <AvatarDisplay url={profile.avatar_url} username={profile.username} size="text-2xl sm:text-3xl" />
              </div>
              <AvatarUpload show={isOwnProfile} uploading={isUploadingAvatar} onClick={() => avatarRef.current?.click()} />
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-1 sm:pt-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-orbitron text-xl sm:text-2xl font-bold text-white truncate">{profile.username}</h1>
                <span className={'text-xs px-2.5 py-1 rounded-full font-bold flex items-center ' + roleBadge}>
                  <AdminIconBadge show={profile.role === 'ADMIN'} />
                  {profile.role}
                </span>
              </div>
              {fullName ? <p className="text-white/60 text-sm mb-1">{fullName}</p> : null}
              <PrivateInfo show={isOwnProfile} label="Email" value={profile.email} />
              <PrivateInfo show={isOwnProfile} label="Phone" value={profile.phone} />
              <div className="flex items-center gap-1.5 text-xs text-white/40 mt-1">
                <Calendar className="w-3 h-3" />
                <span>Joined {joinedDate}</span>
              </div>
              <BioText show={!isEditing} bio={profile.bio} isOwn={isOwnProfile} />
              <SocialRow show={!isEditing} twitter={profile.twitter_username} discord={profile.discord_username} />
            </div>

            <EditBtn show={isOwnProfile && !isEditing} onClick={() => setIsEditing(true)} />
          </div>

          <EditPanel
            show={isEditing}
            form={editForm}
            saving={isSaving}
            onChange={setEditForm}
            onSave={handleSave}
            onCancel={() => setIsEditing(false)}
          />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { icon: MessageSquare, label: 'Posts', value: String(posts.length), color: 'text-cyan-400' },
            { icon: Flame, label: 'Total Likes', value: String(totalLikes), color: 'text-orange-400' },
            { icon: Trophy, label: 'Tournaments', value: '0', color: 'text-yellow-400' },
            { icon: Swords, label: 'Matches', value: '0', color: 'text-purple-400' },
          ].map((stat) => (
            <div key={stat.label} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all text-center">
              <stat.icon className={'w-5 h-5 mx-auto mb-1.5 ' + stat.color} />
              <div className="font-orbitron text-xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-white/40 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          <div className="flex border-b border-white/10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={'flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all flex-1 justify-center ' + (activeTab === tab.id
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5')}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.id === 'posts' && posts.length > 0 ? (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">{posts.length}</span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-orbitron font-bold text-sm text-white/80">
                {activeTab === 'posts' ? postsTitle : activeTab === 'tournaments' ? 'Tournament History' : 'Achievements'}
              </h2>
              {activeTab === 'posts' && isOwnProfile ? (
                <Button asChild size="sm"
                  className="h-7 text-xs bg-gradient-to-r from-cyan-500 to-purple-600 text-white flex items-center gap-1">
                  <Link to="/community">
                    New Post <ChevronRight className="w-3 h-3" />
                  </Link>
                </Button>
              ) : null}
            </div>
            <TabPosts active={activeTab === 'posts'} posts={posts} isOwn={isOwnProfile} />
            <TabTournaments active={activeTab === 'tournaments'} />
            <TabAchievements active={activeTab === 'achievements'} />
          </div>
        </div>

      </div>
    </div>
  );
}