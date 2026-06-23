import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'profile';
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined) ?? (typeof window !== 'undefined' ? window.location.origin : 'https://pulseplay.app');
const DEFAULT_IMAGE = '/pulseplay-logo.jpg';

export function SEO({
  title = 'PulsePlay — Nigeria\'s Premier Mobile Gaming Platform',
  description = 'Join the ultimate mobile gaming community. Compete in tournaments, share clips, join clubs, and connect with gamers.',
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  noindex = false,
  jsonLd,
}: SEOProps): React.ReactElement {
  const fullUrl = url ? `${SITE_URL}${url}` : SITE_URL;
  const fullImage = image.startsWith('http') ? image : `${SITE_URL}${image}`;
  const fullTitle = title.includes('PulsePlay') ? title : `${title} | PulsePlay`;

  return (
    <Helmet>
      {/* Basic */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="PulsePlay" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />

      {/* Canonical */}
      <link rel="canonical" href={fullUrl} />

      {/* JSON-LD Structured Data */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(Array.isArray(jsonLd) ? jsonLd : jsonLd)}
        </script>
      )}
    </Helmet>
  );
}

// ── Structured Data Helpers ───────────────────────────────────────────────────

function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'PulsePlay',
    url: SITE_URL,
    description: 'Nigeria\'s premier mobile gaming tournament platform. Compete in eFootball, CODM, PUBG, and more.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/games?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'PulsePlay',
    url: SITE_URL,
    logo: `${SITE_URL}/pulseplay-logo.jpg`,
    description: 'Nigeria\'s premier mobile gaming tournament platform. Compete, win, and connect with the gaming community.',
    sameAs: [],
  };
}

function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.url}`,
    })),
  };
}

// ── Pre-configured SEO for common pages ───────────────────────────────────────

export function HomeSEO(): React.ReactElement {
  return (
    <SEO
      title="PulsePlay — Nigeria's Premier Mobile Gaming Platform"
      description="Join Nigeria's top mobile gaming community. Compete in eFootball, CODM, and PUBG tournaments. Share clips, join clubs, and connect with gamers."
      url="/"
      jsonLd={[websiteJsonLd(), organizationJsonLd()]}
    />
  );
}

export function GamesSEO(): React.ReactElement {
  return (
    <SEO
      title="Games — eFootball, CODM, PUBG & More"
      description="Explore trending mobile games on PulsePlay. Join tournaments, view leaderboards, and compete in eFootball, Call of Duty Mobile, PUBG, and more."
      url="/games"
      jsonLd={breadcrumbJsonLd([
        { name: 'Home', url: '/' },
        { name: 'Games', url: '/games' },
      ])}
    />
  );
}

export function GameDetailSEO({ name, url }: { name: string; url?: string }): React.ReactElement {
  return (
    <SEO
      title={`${name} — Tournaments & Community`}
      description={`Compete in ${name} tournaments on PulsePlay. Join the community, view upcoming events, and climb the leaderboards.`}
      url={url}
      jsonLd={breadcrumbJsonLd([
        { name: 'Home', url: '/' },
        { name: 'Games', url: '/games' },
        { name, url: url || '/games' },
      ])}
    />
  );
}

export function TournamentsSEO(): React.ReactElement {
  return (
    <SEO
      title="Tournaments — Live Gaming Competitions & Events"
      description="Join live gaming tournaments on PulsePlay. Compete in eFootball, CODM, PUBG, and more. Register for upcoming events and win prizes."
      url="/tournaments"
      jsonLd={breadcrumbJsonLd([
        { name: 'Home', url: '/' },
        { name: 'Tournaments', url: '/tournaments' },
      ])}
    />
  );
}

export function TournamentDetailSEO({ name, date, prizePool }: { name: string; date?: string; prizePool?: string }): React.ReactElement {
  const eventJsonLd = date ? {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    startDate: date,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    organizer: {
      '@type': 'Organization',
      name: 'PulsePlay',
      url: SITE_URL,
    },
    ...(prizePool ? { offers: { '@type': 'Offer', description: `Prize Pool: ${prizePool}` } } : {}),
  } : undefined;

  return (
    <SEO
      title={`${name} — Tournament Details`}
      description={`Register for ${name} on PulsePlay.${prizePool ? ` Prize pool: ${prizePool}.` : ''} View participants and live updates.`}
      jsonLd={eventJsonLd}
    />
  );
}

export function ClipsSEO(): React.ReactElement {
  return (
    <SEO
      title="Weekly Clips — Vote for the Best Gaming Moments"
      description="Vote for the best gaming clips of the week on PulsePlay. Submit your highlights from eFootball, CODM, and PUBG. Winners earn exclusive badges."
      url="/clips"
      jsonLd={breadcrumbJsonLd([
        { name: 'Home', url: '/' },
        { name: 'Clips', url: '/clips' },
      ])}
    />
  );
}

export function CommunitySEO(): React.ReactElement {
  return (
    <SEO
      title="Community — Gaming Discussions, Tips & Tactics"
      description="Join the PulsePlay gaming community. Discuss eFootball and CODM tactics, share tournament tips, and connect with fellow mobile gamers."
      url="/community"
      jsonLd={breadcrumbJsonLd([
        { name: 'Home', url: '/' },
        { name: 'Community', url: '/community' },
      ])}
    />
  );
}

export function CommunityPostSEO({ title, excerpt }: { title: string; excerpt: string }): React.ReactElement {
  return (
    <SEO
      title={title}
      description={excerpt.slice(0, 160)}
      type="article"
    />
  );
}

export function ClubsSEO(): React.ReactElement {
  return (
    <SEO
      title="Clubs & Squads — Build Your Gaming Team"
      description="Join or create gaming clubs on PulsePlay. Build your squad, compete together in tournaments, track stats, and climb the club leaderboards."
      url="/clubs"
      jsonLd={breadcrumbJsonLd([
        { name: 'Home', url: '/' },
        { name: 'Clubs', url: '/clubs' },
      ])}
    />
  );
}

export function ClubDetailSEO({ name, tag }: { name: string; tag: string }): React.ReactElement {
  return (
    <SEO
      title={`[${tag}] ${name} — Club Profile`}
      description={`Join [${tag}] ${name} on PulsePlay. View club stats, members, and upcoming tournaments.`}
    />
  );
}

export function ProfileSEO({ username }: { username: string }): React.ReactElement {
  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: username,
      url: `${SITE_URL}/profile/${username}`,
    },
  };

  return (
    <SEO
      title={`${username} — Gamer Profile`}
      description={`View ${username}'s gaming profile on PulsePlay. See tournament history, stats, achievements, and community posts.`}
      url={`/profile/${username}`}
      type="profile"
      jsonLd={personJsonLd}
    />
  );
}

export function AboutSEO(): React.ReactElement {
  return (
    <SEO
      title="About PulsePlay — Nigeria's Gaming Community"
      description="Learn about PulsePlay, Nigeria's premier mobile gaming tournament platform. Our mission is to build the ultimate competitive gaming community."
      url="/about"
      jsonLd={breadcrumbJsonLd([
        { name: 'Home', url: '/' },
        { name: 'About', url: '/about' },
      ])}
    />
  );
}

export function AuthSEO({ mode }: { mode: 'signin' | 'register' }): React.ReactElement {
  const title = mode === 'signin' ? 'Sign In — PulsePlay' : 'Create Account — PulsePlay';
  return (
    <SEO
      title={title}
      description={mode === 'signin' ? 'Sign in to your PulsePlay account.' : 'Create your PulsePlay account and join the gaming community.'}
      noindex
    />
  );
}

export function NotFoundSEO(): React.ReactElement {
  return (
    <SEO
      title="Page Not Found — PulsePlay"
      description="The page you're looking for doesn't exist. Explore PulsePlay's gaming community."
      noindex
    />
  );
}
