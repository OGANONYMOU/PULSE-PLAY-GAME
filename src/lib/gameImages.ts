const GAME_IMAGE_MAP: { keywords: string[]; path: string }[] = [
  { keywords: ['pubg'],                       path: '/games/pubg.webp' },
  { keywords: ['free fire', 'freefire'],      path: '/games/free-fire.webp' },
  { keywords: ['efootball', 'pes', 'e-foot'], path: '/games/efootball.webp' },
  { keywords: ['fifa', 'ea fc', 'eafc'],       path: '/games/fifa-mobile.webp' },
  { keywords: ['cod', 'call of duty'],        path: '/games/cod-mobile.webp' },
];

export function resolveGameImage(name: string, imageUrlFromDb?: string | null): string | null {
  if (imageUrlFromDb) return imageUrlFromDb;
  const lower = name.toLowerCase();
  for (const entry of GAME_IMAGE_MAP) {
    if (entry.keywords.some(k => lower.includes(k))) return entry.path;
  }
  return null;
}
