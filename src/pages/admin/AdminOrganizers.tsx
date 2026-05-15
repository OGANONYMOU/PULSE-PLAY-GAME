// 
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Plus, Search, Users, Trophy, Crown,
  Globe, Lock, EyeOff, CheckCircle, AlertCircle,
  MoreHorizontal, Edit2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useOrganizers, useOrganizerManagement, type OrganizerWithMembership } from '@/hooks/useOrganizers';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const visibilityIcons = {
  public: Globe,
  private: Lock,
  unlisted: EyeOff,
};

const verifiedColors = {
  unverified: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  verified: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  featured: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

function OrganizerCard({ 
  organizer, 
  onEdit, 
  onManageMembers,
  canManage 
}: { 
  organizer: OrganizerWithMembership; 
  onEdit: (org: OrganizerWithMembership) => void;
  onManageMembers: (org: OrganizerWithMembership) => void;
  canManage: boolean;
}) {
  const VisibilityIcon = visibilityIcons[organizer.visibility];
  
  return (
    <div className="gaming-card p-5 group">
      <div className="flex items-start gap-4">
        <Avatar className="w-14 h-14 rounded-xl border-2 border-white/10">
          <AvatarImage src={organizer.avatar_url || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl">
            <Building2 className="w-6 h-6 text-white" />
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-orbitron font-bold text-lg text-white truncate">
                {organizer.name}
              </h3>
              <p className="text-sm text-white/40 font-mono">@{organizer.slug}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={verifiedColors[organizer.verified_status]}>
                {organizer.verified_status}
              </Badge>
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => onEdit(organizer)}>
                      <Edit2 className="w-4 h-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onManageMembers(organizer)}>
                      <Users className="w-4 h-4 mr-2" /> Members
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          
          {organizer.description && (
            <p className="text-sm text-white/50 mt-2 line-clamp-2">{organizer.description}</p>
          )}
          
          <div className="flex items-center gap-4 mt-4 text-sm text-white/40">
            <div className="flex items-center gap-1.5">
              <VisibilityIcon className="w-3.5 h-3.5" />
              <span className="capitalize">{organizer.visibility}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              <span>{organizer.tournament_count} tournaments</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{organizer.follower_count} followers</span>
            </div>
          </div>
          
          {organizer.owner && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
              <Avatar className="w-5 h-5">
                <AvatarImage src={organizer.owner.avatar_url || undefined} />
                <AvatarFallback className="bg-white/10 text-[10px]">
                  {organizer.owner.username[0]}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-white/40">
                Owner: <span className="text-white/60">{organizer.owner.username}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateOrganizerDialog({ 
  open, 
  onClose, 
  onCreate 
}: { 
  open: boolean; 
  onClose: () => void;
  onCreate: (data: { name: string; slug: string; description: string; visibility: 'public' | 'private' | 'unlisted' }) => Promise<void>;
}) {
  const [form, setForm] = useState<{
    name: string;
    slug: string;
    description: string;
    visibility: 'public' | 'private' | 'unlisted';
  }>({
    name: '',
    slug: '',
    description: '',
    visibility: 'public',
  });
  const [loading, setLoading] = useState(false);

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onCreate(form);
      setForm({ name: '', slug: '', description: '', visibility: 'public' });
      onClose();
    } catch (err) { console.error(err);
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-400" />
            Create Organizer
          </DialogTitle>
          <DialogDescription>
            Create a new tournament organizer/host entity.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Name</label>
            <Input
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm(prev => ({ 
                  ...prev, 
                  name,
                  slug: prev.slug || generateSlug(name)
                }));
              }}
              placeholder="e.g., Lagos eSports Association"
              className="bg-white/5 border-white/10"
              required
            />
          </div>
          
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Slug</label>
            <Input
              value={form.slug}
              onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="lagos-esports-association"
              className="bg-white/5 border-white/10 font-mono text-sm"
              required
            />
            <p className="text-[10px] text-white/30 mt-1">
              Used in URLs: /organizer/{form.slug || 'your-slug'}
            </p>
          </div>
          
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of your organization..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 resize-none h-20"
            />
          </div>
          
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Visibility</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {(['public', 'private', 'unlisted'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, visibility: v }))}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    form.visibility === v
                      ? 'bg-cyan-500/15 border-cyan-500/35 text-cyan-400'
                      : 'border-white/10 text-white/50 hover:border-white/20'
                  }`}
                >
                  {v === 'public' && <Globe className="w-3.5 h-3.5" />}
                  {v === 'private' && <Lock className="w-3.5 h-3.5" />}
                  {v === 'unlisted' && <EyeOff className="w-3.5 h-3.5" />}
                  <span className="capitalize">{v}</span>
                </button>
              ))}
            </div>
          </div>
          
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !form.name.trim() || !form.slug.trim()}
              className="bg-gradient-to-r from-cyan-500 to-purple-600"
            >
              {loading ? 'Creating...' : 'Create Organizer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminOrganizers() {
  const { profile } = useAuth();
  const { organizers, loading, error, refresh } = useOrganizers();
  const { createOrganizer } = useOrganizerManagement();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [, setSelectedOrganizer] = useState<OrganizerWithMembership | null>(null);

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';

  const filteredOrganizers = organizers.filter(org => 
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async (data: Parameters<typeof createOrganizer>[0]) => {
    const result = await createOrganizer(data);
    if (result.success) {
      toast.success('Organizer created successfully!');
      refresh();
    } else {
      toast.error(result.error || 'Failed to create organizer');
      throw new Error(result.error);
    }
  };

  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Error loading organizers</h3>
        <p className="text-white/50">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-orbitron font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-cyan-400" />
            Organizers
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Manage tournament hosts and their permissions
          </p>
        </div>
        
        <Button 
          onClick={() => setCreateDialogOpen(true)}
          className="bg-gradient-to-r from-cyan-500 to-purple-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Organizer
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search organizers by name or slug..."
          className="pl-10 bg-white/5 border-white/10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', value: organizers.length, icon: Building2, color: 'text-cyan-400' },
          { label: 'Verified', value: organizers.filter(o => o.verified_status === 'verified').length, icon: CheckCircle, color: 'text-blue-400' },
          { label: 'Featured', value: organizers.filter(o => o.verified_status === 'featured').length, icon: Crown, color: 'text-purple-400' },
          { label: 'Tournaments', value: organizers.reduce((acc, o) => acc + o.tournament_count, 0), icon: Trophy, color: 'text-yellow-400' },
        ].map((stat) => (
          <div key={stat.label} className="gaming-card p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-white/40">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Organizers Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="gaming-card p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/10" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-white/10 rounded w-1/2" />
                  <div className="h-3 bg-white/10 rounded w-1/3" />
                  <div className="h-3 bg-white/10 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredOrganizers.length === 0 ? (
        <div className="gaming-card p-12 text-center">
          <Building2 className="w-12 h-12 mx-auto text-white/20 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            {searchQuery ? 'No organizers found' : 'No organizers yet'}
          </h3>
          <p className="text-white/50 text-sm max-w-md mx-auto">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Create your first organizer to start hosting tournaments under a branded identity.'
            }
          </p>
          {!searchQuery && (
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              className="mt-4 bg-gradient-to-r from-cyan-500 to-purple-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Organizer
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrganizers.map((organizer) => (
            <motion.div
              key={organizer.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              layout
            >
              <OrganizerCard
                organizer={organizer}
                onEdit={setSelectedOrganizer}
                onManageMembers={setSelectedOrganizer}
                canManage={isAdmin || organizer.owner_id === profile?.id}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CreateOrganizerDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
