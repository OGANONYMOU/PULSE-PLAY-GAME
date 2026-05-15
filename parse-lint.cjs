const fs = require('fs');
const data = JSON.parse(fs.readFileSync('lint-results.json', 'utf8'));
const targets = [
  'AdminCommunity.tsx',
  'AdminDashboard.tsx',
  'AdminGames.tsx',
  'AdminIncidents.tsx',
  'AdminModeration.tsx',
  'AdminPermissions.tsx',
  'AdminPosts.tsx',
  'AdminTournaments.tsx',
  'AdminUsers.tsx'
];

data.filter(f => targets.some(t => f.filePath.endsWith(t))).forEach(f => {
  console.log('\n--- ' + f.filePath);
  f.messages.forEach(m => console.log(`[Line ${m.line}] ${m.ruleId}: ${m.message}`));
});
