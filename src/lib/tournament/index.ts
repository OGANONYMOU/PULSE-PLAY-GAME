// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Tournament Engine Exports
// ═══════════════════════════════════════════════════════════════════════════════

// Bracket System
export {
  generateSingleEliminationBracket,
  generateDoubleEliminationBracket,
  saveBracket,
  reportMatchResult,
  overrideMatchResult,
  lockBracket,
  unlockBracket,
} from './bracketEngine';

export type {
  BracketType,
  BracketParticipant,
  BracketMatch,
  GeneratedBracket,
  BracketStandings,
} from './bracketEngine';

// Fixture Generator
export {
  generateRoundRobin,
  generateGroupStage,
  saveFixtures,
  rescheduleFixture,
  reportFixtureResult,
  calculateGroupStandings,
} from './fixtureGenerator';

export type {
  FixtureParticipant,
  Fixture,
  GroupConfig,
  GeneratedFixtures,
  GroupStandings,
} from './fixtureGenerator';

// Seeding System
export {
  randomSeed,
  rankingSeed,
  gamercredSeed,
  snakeSeedForGroups,
  applySeeding,
  recommendSeeding,
} from './seedingSystem';

export type {
  SeedingMethod,
  SeedParticipant,
  SeededParticipant,
} from './seedingSystem';
