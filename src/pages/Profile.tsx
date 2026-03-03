import React, { useState, useEffect, useRef } from 'react';
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

function getRoleClass(role: string): string {
  if (role === 'ADMIN') return 'bg-red-500/20 text-red-400 border-red-500/30';
  if (role === 'MODERATOR') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
}

function getTagClass(tag: string): string {
  if (tag === 'general') return 'bg-blue-500/20 text-blue-400';
  if (tag === 'tournament') return 'bg-purple-500/20 text-purple-400';
  if (tag === 'tips') return 'bg-green-500/20 text-green-400';
  if (tag === 'clips') return 'bg-pink-500/20 text-pink-400';
  return 'bg-muted text-muted-foreground';
}

// All sub-components defined outside Profile to avoid JSX parser issues

function BannerDisplay(p: { url: string | null }): React.ReactElement {
  if (p.url) {
    return <img src={p.url} alt="Banner" className="w-full h-full object-cover" />;
  }
  return <div className="w-full h-full bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20" />;
}

function BannerUploadBtn(p: {
  show: boolean;
  uploading: boolean;
  onClick: () => void;
}): React.ReactElement {
  if (!p.show) return <span />;
  const label = p.uploading ? 'Uploading...' : 'Change Banner';
  return (
    <button
      onClick={p.onClick}
      disabled={p.uploading}
      className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs transition-colors border border-white/10"
    >
      <Camera className="w-3 h-3" />
      <span>{label}</span>
    </button>
  );
}

function AvatarUploadBtn(p: {
  show: boolean;
  uploading: boolean;
  onClick: () => void;
}): React.ReactElement {
  if (!p.show) return <span />;
  return (
    <button
      onClick={p.onClick}
      disabled={p.uploading}
      className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-cyan-500 hover:bg-cyan-400 flex items-center justify-center transition-colors border-2 border-background"
    >
      <Camera className="w-3.5 h-3.5 text-white" />
    </button>
  );
}

function AdminIcon(p: { show: boolean }): React.ReactElement {
  if (!p.show) return <span />;
  return <Shield className="w-3 h-3 mr-1" />;
}

function FullNameRow(p: { name: string }): React.ReactElement {
  if (!p.name) return <span />;
  return <p className="text-muted-foreground text-sm mb-1">{p.name}</p>;
}

function PrivateRow(p: { show: boolean; value: string | null }): React.ReactElement {
  if (!p.show || !p.value) return <span />;
  return <p className="text-muted-foreground text-xs mb-1">{p.value}</p>;
}

function EditProfileBtn(p: { show: boolean; onClick: () => void }): React.ReactElement {
  if (!p.show) return <span />;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={p.onClick}
      className="border-cyan-500/50 hover:bg-cyan-500/10"
    >
      <Edit2 className="w-4 h-4 mr-2" />
      Edit Profile
    </Button>
  );
}

function BioDisplay(p: { show: boolean; text: string }): React.ReactElement {
  if (!p.show) return <span />;
  return <p className="text-muted-foreground text-sm mt-3 max-w-xl">{p.text}</p>;
}

function TwitterLink(p: { username: string | null }): React.ReactElement {
  if (!p.username) return <span />;
  const url = 'https://twitter.com/' + p.username;
  const label = 'at' + p.username;
  return (
    
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-cyan-400 transition-colors"
    >
      <Twitter className="w-3.5 h-3.5" />
      <span>{label}</span>
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}

function DiscordDisplay(p: { username: string | null }): React.ReactElement {
  if (!p.username) return <span />;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <MessageSquare className="w-3.5 h-3.5" />
      <span>{p.username}</span>
    </span>
  );
}

function SocialsRow(p: { show: boolean; twitter: string | null; discord: string | null }): React.ReactElement {
  if (!p.show) return <span />;
  if (!p.twitter && !p.discord) return <span />;
  return (
    <div className="flex items-center gap-3 mt-3 flex-wrap">
      <TwitterLink username={p.twitter} />
      <DiscordDisplay username={p.discord} />
    </div>
  );
}

function EditSection(p: {
  show: boolean;
  form: EditForm;
  saving: boolean;
  onChange: (f: EditForm) => void;
  onSave: () => void;
  onCancel: () => void;
}): React.ReactElement {
  if (!p.show) return <span />;
  const saveLabel = p.saving ? 'Saving...' : 'Save Changes';
  const charCount = p.form.bio.length + '/300';
  return (
    <div className="mt-6 space-y-4">
      <Separator />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">First Name</label>
          <Input
            value={p.form.first_name}
            onChange={(e) => p.onChange({ ...p.form, first_name: e.target.value })}
            className="bg-muted/50"
            placeholder="First name"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Last Name</label>
          <Input
            value={p.form.last_name}
            onChange={(e) => p.onChange({ ...p.form, last_name: e.target.value })}
            className="bg-muted/50"
            placeholder="Last name"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Bio</label>
        <Textarea
          value={p.form.bio}
          onChange={(e) => p.onChange({ ...p.form, bio: e.target.value })}
          className="bg-muted/50 resize-none"
          rows={3}
          placeholder="Tell the community about yourself..."
          maxLength={300}
        />
        <span className="text-xs text-muted-foreground mt-1 block">{charCount}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Twitter Username</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
            <Input
              value={p.form.twitter_username}
              onChange={(e) => p.onChange({ ...p.form, twitter_username: e.target.value })}
              className="pl-7 bg-muted/50"
              placeholder="username"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Discord Username</label>
          <Input
            value={p.form.discord_username}
            onChange={(e) => p.onChange({ ...p.form, discord_username: e.target.value })}
            className="bg-muted/50"
            placeholder="username#0000"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={p.onCancel} disabled={p.saving}>
          <X className="w-4 h-4 mr-1" />
          <span>Cancel</span>
        </Button>
        <Button size="sm" onClick={p.onSave} disabled={p.saving} className="bg-gradient-to-r from-cyan-500 to-purple-600">
          <Save className="w-4 h-4 mr-1" />
          <span>{saveLabel}</span>
        </Button>
      </div>
    </div>
  );
}

function EmptyPosts(p: { isOwn: boolean }): React.ReactElement {
  return (
    <div className="gaming-card p-12 text-center">
      <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
      <p className="text-muted-foreground">No posts yet.</p>
      {p.isOwn ? (
        <Button asChild size="sm" className="mt-4 bg-gradient-to-r from-cyan-500 to-purple-600">
          <Link to="/community">Share your first post</Link>
        </Button>
      ) : null}
    </div>
  );
}

function PostCard(p: { post: PostItem }): React.ReactElement {
  const tagClass = getTagClass(p.post.tag);
  const timeAgo = formatDistanceToNow(new Date(p.post.created_at), { addSuffix: true });
  return (
    <div className="gaming-card p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-orbitron font-bold text-sm">{p.post.title}</h3>
        <Badge className={'flex-shrink-0 ' + tagClass}>
          <span>{p.post.tag}</span>
        </Badge>
      </div>
      <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{p.post.content}</p>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Flame className="w-3 h-3" />
          <span>{p.post.likes}</span>
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          <span>{p.post.comments}</span>
        </span>
        <span className="ml-auto">{timeAgo}</span>
      </div>
    </div>
  );
}

export function Profile(): React.ReactElement {
  const { username } = useParams<{ username?: string }>();
  const { user, profile: ownProfile, updateProfile } = useAuth();

  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

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
      setNotFound(false);
      let found: ProfileType | null = null;

      if (isOwnProfile) {
        if (ownProfile) {
          found = ownProfile;
        } else if (user) {
          const res = await supabase.from('profiles').select('*').eq('id', user.id).single();
          found = res.data as ProfileType | null;
        }
      } else if (username) {
        const res = await supabase.from('profiles').select('*').eq('username', username).single();
        found = res.data as ProfileType | null;
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
        const pr = await supabase
          .from('posts')
          .select('*')
          .eq('author_id', found.id)
          .order('created_at', { ascending: false })
          .limit(10);
        setPosts((pr.data as PostItem[]) ?? []);
      } else {
        setNotFound(true);
      }
      setIsLoading(false);
    };

    if (!isOwnProfile || user !== undefined) {
      load();
    }
  }, [username, ownProfile, user, isOwnProfile]);

  const handleSave = async () => {
    setIsSaving(true);
    const res = await updateProfile(editForm);
    if (res.error) {
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
    suffix: string,
    field: 'avatar_url' | 'banner_url',
    setUploading: (v: boolean) => void
  ) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = user.id + '/' + suffix + '.' + ext;
    const up = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (up.error) {
      toast.error('Upload failed.');
      setUploading(false);
      return;
    }
    const pub = supabase.storage.from('avatars').getPublicUrl(path);
    const url = pub.data.publicUrl;
    const upd = await updateProfile({ [field]: url });
    if (upd.error) {
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

  const totalLikes = posts.reduce((s, p) => s + p.likes, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 px-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="font-orbitron text-2xl font-bold mb-2">User Not Found</h2>
          <p className="text-muted-foreground mb-6">This profile does not exist.</p>
          <Button asChild variant="outline">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
  const bioText = profile.bio
    ? profile.bio
    : isOwnProfile
      ? 'No bio yet - click Edit Profile to add one.'
      : 'No bio yet.';
  const postsTitle = isOwnProfile ? 'My Posts' : profile.username + "'s Posts";
  const joinedDate = 'Joined ' + format(new Date(profile.created_at), 'MMMM yyyy');
  const avatarFallback = profile.username[0] ? profile.username[0].toUpperCase() : 'U';
  const roleClass = getRoleClass(profile.role);

  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-4xl mx-auto space-y-4">

        <div className="relative h-48 rounded-2xl overflow-hidden gaming-card">
          <BannerDisplay url={profile.banner_url} />
          <BannerUploadBtn
            show={isOwnProfile}
            uploading={isUploadingBanner}
            onClick={() => bannerInputRef.current?.click()}
          />
          <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={onBannerChange} />
        </div>

        <div className="gaming-card p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">

            <div className="relative -mt-16 flex-shrink-0">
              <Avatar className="w-24 h-24 border-4 border-background ring-2 ring-cyan-500/50">
                <AvatarImage src={profile.avatar_url ?? ''} alt={profile.username} />
                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-2xl font-bold text-white">
                  {avatarFallback}
                </AvatarFallback>
              </Avatar>
              <AvatarUploadBtn
                show={isOwnProfile}
                uploading={isUploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
              />
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h1 className="font-orbitron text-2xl font-bold">{profile.username}</h1>
                    <Badge className={roleClass}>
                      <AdminIcon show={profile.role === 'ADMIN'} />
                      <span>{profile.role}</span>
                    </Badge>
                  </div>
                  <FullNameRow name={fullName} />
                  <PrivateRow show={isOwnProfile} value={profile.email} />
                  <PrivateRow show={isOwnProfile} value={profile.phone} />
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Calendar className="w-3 h-3" />
                    <span>{joinedDate}</span>
                  </div>
                </div>
                <EditProfileBtn show={isOwnProfile && !isEditing} onClick={() => setIsEditing(true)} />
              </div>
              <BioDisplay show={!isEditing} text={bioText} />
              <SocialsRow show={!isEditing} twitter={profile.twitter_username} discord={profile.discord_username} />
            </div>
          </div>

          <EditSection
            show={isEditing}
            form={editForm}
            saving={isSaving}
            onChange={setEditForm}
            onSave={handleSave}
            onCancel={() => setIsEditing(false)}
          />
        </div>

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

        <div>
          <h2 className="font-orbitron font-bold text-lg mb-4">{postsTitle}</h2>
          {posts.length === 0 ? (
            <EmptyPosts isOwn={isOwnProfile} />
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}