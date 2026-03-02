import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Camera, Edit2, Save, X, Twitter, Trophy,
  Flame, Calendar, MessageSquare, Shield, User, ExternalLink,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, type Profile as ProfileType } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

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

function getRoleClass(role: string) {
  if (role === 'ADMIN') return 'bg-red-500/20 text-red-400 border-red-500/30';
  if (role === 'MODERATOR') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
}

function getTagClass(tag: string) {
  if (tag === 'general') return 'bg-blue-500/20 text-blue-400';
  if (tag === 'tournament') return 'bg-purple-500/20 text-purple-400';
  if (tag === 'tips') return 'bg-green-500/20 text-green-400';
  if (tag === 'clips') return 'bg-pink-500/20 text-pink-400';
  return 'bg-muted text-muted-foreground';
}

export function Profile() {
  const { username } = useParams<{ username?: string }>();
  const { user, profile: ownProfile, updateProfile } = useAuth();

  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [editForm, setEditForm] = useState<EditForm>({
    first_name: '',
    last_name: '',
    bio: '',
    discord_username: '',
    twitter_username: '',
  });

  const isOwnProfile = !username || username === ownProfile?.username;

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      let profileData: ProfileType | null = null;

      if (isOwnProfile && ownProfile) {
        profileData = ownProfile;
      } else if (username) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .single();
        profileData = data as unknown as ProfileType;
      }

      if (profileData) {
        setProfile(profileData);
        setEditForm({
          first_name: profileData.first_name ?? '',
          last_name: profileData.last_name ?? '',
          bio: profileData.bio ?? '',
          discord_username: profileData.discord_username ?? '',
          twitter_username: profileData.twitter_username ?? '',
        });
        const { data: postsData } = await supabase
          .from('posts')
          .select('*')
          .eq('author_id', profileData.id)
          .order('created_at', { ascending: false })
          .limit(10);
        setPosts((postsData as PostItem[]) ?? []);
      }
      setIsLoading(false);
    };
    load();
  }, [username, ownProfile, isOwnProfile]);

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await updateProfile(editForm);
    if (error) {
      toast.error('Failed to save profile.');
    } else {
      toast.success('Profile updated!');
      setProfile((prev) => (prev ? { ...prev, ...editForm } : prev));
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const uploadFile = async (
    file: File,
    pathSuffix: string,
    field: 'avatar_url' | 'banner_url',
    setUploading: (v: boolean) => void
  ) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${pathSuffix}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });
    if (uploadError) {
      toast.error('Upload failed.');
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const { error } = await updateProfile({ [field]: publicUrl });
    if (error) {
      toast.error('Failed to save URL.');
    } else {
      setProfile((prev) => (prev ? { ...prev, [field]: publicUrl } : prev));
      toast.success('Image updated!');
    }
    setUploading(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file, 'avatar', 'avatar_url', setIsUploadingAvatar);
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file, 'banner', 'banner_url', setIsUploadingBanner);
  };

  const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0);
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 px-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="font-orbitron text-2xl font-bold mb-2">User Not Found</h2>
          <p className="text-muted-foreground">This profile does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-4xl mx-auto space-y-4">

        {/* Banner */}
        <div className="relative h-48 rounded-2xl overflow-hidden gaming-card">
          {profile.banner_url
            ? <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20" />
          }
          {isOwnProfile && (
            <button
              onClick={() => bannerInputRef.current?.click()}
              disabled={isUploadingBanner}
              className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white text-xs transition-colors"
            >
              <Camera className="w-3 h-3" />
              {isUploadingBanner ? 'Uploading...' : 'Change Banner'}
            </button>
          )}
          <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
        </div>

        {/* Profile Card */}
        <div className="gaming-card p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="relative -mt-16 flex-shrink-0">
              <Avatar className="w-24 h-24 border-4 border-background ring-2 ring-cyan-500/50">
                <AvatarImage src={profile.avatar_url ?? ''} />
                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-2xl font-bold text-white">
                  {profile.username[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-cyan-500 hover:bg-cyan-400 flex items-center justify-center transition-colors"
                >
                  <Camera className="w-3.5 h-3.5 text-white" />
                </button>
              )}
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h1 className="font-orbitron text-2xl font-bold">{profile.username}</h1>
                    <Badge className={getRoleClass(profile.role)}>
                      {profile.role === 'ADMIN' && <Shield className="w-3 h-3 mr-1" />}
                      {profile.role}
                    </Badge>
                  </div>
                  {fullName && <p className="text-muted-foreground text-sm mb-1">{fullName}</p>}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    Joined {format(new Date(profile.created_at), 'MMMM yyyy')}
                  </div>
                </div>
                {isOwnProfile && !isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="border-cyan-500/50 hover:bg-cyan-500/10"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                )}
              </div>

              {!isEditing && (
                <p className="text-muted-foreground text-sm mt-3 max-w-xl">
                  {profile.bio || (isOwnProfile ? 'No bio yet - click Edit Profile to add one.' : 'No bio yet.')}
                </p>
              )}

              {!isEditing && (
  <div className="flex items-center gap-3 mt-3 flex-wrap">
    {profile.twitter_username ? (
      
        href={"https://twitter.com/" + profile.twitter_username}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-cyan-400 transition-colors"
      >
        <Twitter className="w-3.5 h-3.5" />
        <span>@{profile.twitter_username}</span>
        <ExternalLink className="w-3 h-3" />
      </a>
    ) : null}
    {profile.discord_username ? (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MessageSquare className="w-3.5 h-3.5" />
        {profile.discord_username}
      </span>
    ) : null}
  </div>
)}
          {/* Edit Form */}
          {isEditing && (
            <div className="mt-6 space-y-4">
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">First Name</label>
                  <Input
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="mt-1 bg-muted/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Last Name</label>
                  <Input
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="mt-1 bg-muted/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Bio</label>
                <Textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="mt-1 bg-muted/50 resize-none"
                  rows={3}
                  placeholder="Tell the community about yourself..."
                  maxLength={300}
                />
                <p className="text-xs text-muted-foreground mt-1">{editForm.bio.length}/300</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Twitter Username</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                    <Input
                      value={editForm.twitter_username}
                      onChange={(e) => setEditForm({ ...editForm, twitter_username: e.target.value })}
                      className="pl-7 bg-muted/50"
                      placeholder="username"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Discord Username</label>
                  <Input
                    value={editForm.discord_username}
                    onChange={(e) => setEditForm({ ...editForm, discord_username: e.target.value })}
                    className="mt-1 bg-muted/50"
                    placeholder="username#0000"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-gradient-to-r from-cyan-500 to-purple-600"
                >
                  <Save className="w-4 h-4 mr-1" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="gaming-card p-4 text-center">
            <MessageSquare className="w-5 h-5 mx-auto text-cyan-400 mb-2" />
            <div className="font-orbitron text-xl font-bold">{posts.length}</div>
            <div className="text-xs text-muted-foreground">Posts</div>
          </div>
          <div className="gaming-card p-4 text-center">
            <Flame className="w-5 h-5 mx-auto text-orange-400 mb-2" />
            <div className="font-orbitron text-xl font-bold">{totalLikes}</div>
            <div className="text-xs text-muted-foreground">Total Likes</div>
          </div>
          <div className="gaming-card p-4 text-center">
            <Trophy className="w-5 h-5 mx-auto text-yellow-400 mb-2" />
            <div className="font-orbitron text-xl font-bold">0</div>
            <div className="text-xs text-muted-foreground">Tournaments</div>
          </div>
        </div>

        {/* Posts */}
        <div>
          <h2 className="font-orbitron font-bold text-lg mb-4">
            {isOwnProfile ? 'My Posts' : profile.username + "'s Posts"}
          </h2>

          {posts.length === 0 && (
            <div className="gaming-card p-12 text-center">
              <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No posts yet.</p>
              {isOwnProfile && (
                <Button asChild size="sm" className="mt-4 bg-gradient-to-r from-cyan-500 to-purple-600">
                  <Link to="/community">Share your first post</Link>
                </Button>
              )}
            </div>
          )}

          {posts.length > 0 && (
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="gaming-card p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-orbitron font-bold text-sm">{post.title}</h3>
                    <Badge className={`flex-shrink-0 ${getTagClass(post.tag)}`}>{post.tag}</Badge>
                  </div>
                  <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{post.content}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Flame className="w-3 h-3" />{post.likes}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{post.comments}</span>
                    <span className="ml-auto">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}