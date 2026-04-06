/**
 * Player profile page — full bio, year-by-year stats, game log, awards.
 * NHL: api-web.nhle.com, MLB: statsapi.mlb.com, NBA/NFL: ESPN.
 */

/* ── Helpers ── */
function hs(url, size = 200) {
  if (!url) return '';
  if (url.includes('espncdn.com')) {
    const path = url.replace(/^https?:\/\/a\.espncdn\.com/, '');
    return `https://a.espncdn.com/combiner/i?img=${path}&w=${size}&h=${size}`;
  }
  return url;
}

function section(title) {
  return `<div class="font-mono text-[11px] text-ink-muted uppercase tracking-widest mt-8 mb-3 flex items-center gap-2">${title}<span class="flex-1 h-px bg-ink-faint/15"></span></div>`;
}

function bio(label, value) {
  if (!value) return '';
  return `<div class="flex items-start gap-3 py-1.5"><span class="font-mono text-[10px] text-ink-muted uppercase tracking-widest w-20 shrink-0 pt-0.5">${label}</span><span class="font-sans text-sm text-ink">${value}</span></div>`;
}

function numCard(label, value) {
  return `<div class="text-center p-2.5 rounded-xl bg-surface-elevated/60 border border-ink-faint/8">
    <div class="font-mono text-lg font-bold text-ink tabular-nums leading-none">${value ?? '-'}</div>
    <div class="font-mono text-[9px] text-ink-muted uppercase tracking-widest mt-1.5">${label}</div>
  </div>`;
}

function skeleton() {
  return `<div class="pt-6 space-y-6 opacity-0 animate-fade-up">
    <div class="flex items-center gap-5"><div class="skeleton w-24 h-24 rounded-2xl"></div><div class="space-y-2 flex-1"><div class="skeleton h-6 w-48"></div><div class="skeleton h-4 w-32"></div></div></div>
    <div class="grid grid-cols-4 gap-2">${Array(8).fill('<div class="skeleton h-16 rounded-xl"></div>').join('')}</div>
    <div class="skeleton h-64 rounded-2xl"></div>
  </div>`;
}

/* ── NHL ── */
async function loadNhl(name) {
  const sr = await fetch(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=1&q=${encodeURIComponent(name)}&active=true`);
  const sd = await sr.json();
  if (!sd?.[0]?.playerId) throw new Error('Player not found');
  const res = await fetch(`https://api-web.nhle.com/v1/player/${sd[0].playerId}/landing`);
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

function renderNhl(p) {
  const name = `${p.firstName?.default || ''} ${p.lastName?.default || ''}`;
  const age = p.birthDate ? Math.floor((Date.now() - new Date(p.birthDate).getTime()) / 31557600000) : '';
  const draft = p.draftDetails;
  const cs = p.featuredStats?.regularSeason?.subSeason || {};
  const career = p.careerTotals?.regularSeason || {};
  const seasons = (p.seasonTotals || []).filter(s => s.leagueAbbrev === 'NHL' && s.gameTypeId === 2);
  const last5 = p.last5Games || [];
  const awards = p.awards || [];

  return `
    <!-- Hero -->
    ${p.heroImage ? `<div class="relative h-52 sm:h-64 overflow-hidden rounded-t-3xl bg-ink/80">
      <img src="${p.heroImage}" class="w-full h-full object-cover object-top" onerror="this.parentElement.style.display='none'" />
      <div class="absolute inset-0 bg-gradient-to-t from-surface-card via-surface-card/20 to-transparent"></div>
    </div>` : ''}

    <div class="px-5 sm:px-8 pb-8 ${p.heroImage ? '-mt-16 relative' : 'pt-8'}">
      <!-- Header -->
      <div class="flex items-end gap-5 mb-6">
        <img src="${p.headshot || ''}" class="w-24 h-24 rounded-2xl object-cover bg-surface-elevated border-2 border-surface-card shadow-diffused" onerror="this.style.display='none'" />
        <div class="min-w-0 flex-1 pb-1">
          <h1 class="font-sans text-2xl sm:text-3xl font-bold text-ink leading-tight truncate">${name}</h1>
          <div class="flex items-center gap-2 mt-1.5">
            ${p.teamLogo ? `<img src="${p.teamLogo}" class="w-5 h-5 object-contain" />` : ''}
            <span class="font-mono text-xs text-ink-secondary">${p.fullTeamName?.default || ''}</span>
            <span class="font-mono text-xs text-ink-muted">#${p.sweaterNumber || ''} / ${p.position || ''}</span>
          </div>
        </div>
      </div>

      <!-- Bio -->
      <div class="rounded-2xl bg-surface-elevated/30 border border-ink-faint/8 p-4 divide-y divide-ink-faint/8">
        ${bio('Height', `${p.heightInCentimeters || ''}cm (${p.heightInInches || ''}")`)}
        ${bio('Weight', `${p.weightInPounds || ''} lbs (${p.weightInKilograms || ''} kg)`)}
        ${bio('Age', `${age}${p.birthDate ? '  --  Born ' + p.birthDate : ''}`)}
        ${bio('Born in', `${p.birthCity?.default || ''}${p.birthStateProvince?.default ? ', ' + p.birthStateProvince.default : ''}, ${p.birthCountry || ''}`)}
        ${bio('Shoots', p.shootsCatches === 'L' ? 'Left' : p.shootsCatches === 'R' ? 'Right' : '')}
        ${draft ? bio('Draft', `${draft.year} Round ${draft.round}, Pick ${draft.pickInRound} (#${draft.overallPick} overall) -- ${draft.teamAbbrev}`) : ''}
        ${p.inHHOF ? bio('Honors', 'Hockey Hall of Fame') : ''}
        ${p.inTop100AllTime ? bio('Honors', 'NHL Top 100 All-Time') : ''}
      </div>

      <!-- Current Season -->
      ${section('2025-26 Season')}
      <div class="grid grid-cols-4 sm:grid-cols-8 gap-2">
        ${numCard('GP', cs.gamesPlayed)}${numCard('G', cs.goals)}${numCard('A', cs.assists)}${numCard('PTS', cs.points)}
        ${numCard('+/-', cs.plusMinus)}${numCard('PIM', cs.pim)}${numCard('PPG', cs.powerPlayGoals)}${numCard('S', cs.shots)}
      </div>

      <!-- Career -->
      ${section('Career Totals')}
      <div class="grid grid-cols-4 sm:grid-cols-8 gap-2">
        ${numCard('GP', career.gamesPlayed)}${numCard('G', career.goals)}${numCard('A', career.assists)}
        ${numCard('PTS', (career.goals || 0) + (career.assists || 0))}${numCard('+/-', career.plusMinus)}
        ${numCard('GWG', career.gameWinningGoals)}${numCard('S%', career.shootingPctg != null ? (career.shootingPctg * 100).toFixed(1) : '-')}
        ${numCard('TOI/G', career.avgToi || '-')}
      </div>

      <!-- Season-by-Season -->
      ${seasons.length > 0 ? `
        ${section('Season History')}
        <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
          <table class="w-full text-sm font-mono tabular-nums min-w-[600px]">
            <thead><tr class="border-b border-ink-faint/10 bg-surface-elevated/30 text-[10px] text-ink-muted uppercase tracking-widest">
              <th class="text-left px-3 py-2">Season</th><th class="text-left px-2 py-2">Team</th>
              <th class="text-center px-2 py-2">GP</th><th class="text-center px-2 py-2">G</th>
              <th class="text-center px-2 py-2">A</th><th class="text-center px-2 py-2 font-semibold text-accent">PTS</th>
              <th class="text-center px-2 py-2">+/-</th><th class="text-center px-2 py-2">PIM</th>
              <th class="text-center px-2 py-2 hidden sm:table-cell">PPG</th>
              <th class="text-center px-2 py-2 hidden sm:table-cell">S</th>
              <th class="text-center px-2 py-2 hidden sm:table-cell">S%</th>
              <th class="text-center px-2 py-2 hidden md:table-cell">TOI/G</th>
            </tr></thead>
            <tbody>
              ${seasons.map(s => {
                const yr = String(s.season);
                const display = yr.slice(0, 4) + '-' + yr.slice(4);
                return `<tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/30">
                  <td class="px-3 py-2 text-ink-secondary text-xs">${display}</td>
                  <td class="px-2 py-2 text-ink-secondary text-xs">${s.teamName?.default || ''}</td>
                  <td class="text-center px-2 py-2">${s.gamesPlayed ?? '-'}</td>
                  <td class="text-center px-2 py-2">${s.goals ?? '-'}</td>
                  <td class="text-center px-2 py-2">${s.assists ?? '-'}</td>
                  <td class="text-center px-2 py-2 font-semibold text-ink">${(s.goals || 0) + (s.assists || 0)}</td>
                  <td class="text-center px-2 py-2">${s.plusMinus ?? '-'}</td>
                  <td class="text-center px-2 py-2">${s.pim ?? '-'}</td>
                  <td class="text-center px-2 py-2 hidden sm:table-cell">${s.powerPlayGoals ?? '-'}</td>
                  <td class="text-center px-2 py-2 hidden sm:table-cell">${s.shots ?? '-'}</td>
                  <td class="text-center px-2 py-2 hidden sm:table-cell">${s.shootingPctg != null ? (s.shootingPctg * 100).toFixed(1) : '-'}</td>
                  <td class="text-center px-2 py-2 hidden md:table-cell">${s.avgToi || '-'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- Game Log -->
      ${last5.length > 0 ? `
        ${section('Recent Games')}
        <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
          <table class="w-full text-sm font-mono tabular-nums min-w-[500px]">
            <thead><tr class="border-b border-ink-faint/10 bg-surface-elevated/30 text-[10px] text-ink-muted uppercase tracking-widest">
              <th class="text-left px-3 py-2">Date</th><th class="text-center px-2 py-2">Opp</th>
              <th class="text-center px-2 py-2">G</th><th class="text-center px-2 py-2">A</th>
              <th class="text-center px-2 py-2 font-semibold text-accent">PTS</th><th class="text-center px-2 py-2">+/-</th>
              <th class="text-center px-2 py-2">S</th><th class="text-center px-2 py-2">TOI</th>
            </tr></thead>
            <tbody>
              ${last5.map(g => `<tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/30">
                <td class="px-3 py-2 text-ink-muted text-xs">${g.gameDate || ''}</td>
                <td class="text-center px-2 py-2 text-ink-secondary text-xs">${g.homeRoadFlag === 'H' ? 'vs' : '@'} ${g.opponentAbbrev || ''}</td>
                <td class="text-center px-2 py-2">${g.goals ?? 0}</td>
                <td class="text-center px-2 py-2">${g.assists ?? 0}</td>
                <td class="text-center px-2 py-2 font-semibold text-ink">${g.points ?? 0}</td>
                <td class="text-center px-2 py-2">${g.plusMinus ?? 0}</td>
                <td class="text-center px-2 py-2">${g.shots ?? 0}</td>
                <td class="text-center px-2 py-2">${g.toi || ''}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- Awards -->
      ${awards.length > 0 ? `
        ${section('Awards')}
        <div class="space-y-1.5">
          ${awards.map(a => `<div class="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-elevated/30">
            <span class="font-sans text-sm text-ink">${a.trophy?.default || 'Award'}</span>
            <span class="font-mono text-[10px] text-ink-muted">${(a.seasons || []).map(s => String(s.seasonId).slice(0, 4) + '-' + String(s.seasonId).slice(4)).join(', ')}</span>
          </div>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/* ── MLB ── */
async function loadMlb(id) {
  const [personRes, logRes] = await Promise.all([
    fetch(`https://statsapi.mlb.com/api/v1/people/${id}?hydrate=stats(group=[hitting,pitching,fielding],type=[yearByYear,career]),awards,currentTeam`),
    fetch(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=gameLog&season=2026&group=hitting`),
  ]);
  const person = (await personRes.json()).people?.[0];
  const logData = await logRes.json();
  if (person) person._gameLog = logData.stats?.[0]?.splits || [];
  return person;
}

function renderMlb(p) {
  const hsUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_200,q_auto:best/v1/people/${p.id}/headshot/67/current`;
  const teamLogo = p.currentTeam?.id ? `https://www.mlbstatic.com/team-logos/${p.currentTeam.id}.svg` : '';

  const getStats = (group, type) => p.stats?.find(s => s.group?.displayName === group && s.type?.displayName === type);
  const hitYby = getStats('hitting', 'yearByYear')?.splits || [];
  const pitchYby = getStats('pitching', 'yearByYear')?.splits || [];
  const hitCareer = getStats('hitting', 'career')?.splits?.[0]?.stat;
  const pitchCareer = getStats('pitching', 'career')?.splits?.[0]?.stat;
  const gameLog = p._gameLog || [];
  const awards = p.awards || [];
  const awardMap = {};
  awards.forEach(a => { const n = a.name || 'Award'; if (!awardMap[n]) awardMap[n] = []; awardMap[n].push(a.season); });

  const isHitter = hitYby.length > 0 || !!hitCareer;
  const isPitcher = pitchYby.length > 0 || !!pitchCareer;

  return `
    <div class="px-5 sm:px-8 py-8">
      <!-- Header -->
      <div class="flex items-end gap-5 mb-6">
        <img src="${hsUrl}" class="w-24 h-24 rounded-2xl object-cover bg-surface-elevated shadow-diffused" onerror="this.style.display='none'" />
        <div class="min-w-0 flex-1 pb-1">
          <h1 class="font-sans text-2xl sm:text-3xl font-bold text-ink leading-tight truncate">${p.fullName || '?'}</h1>
          <div class="flex items-center gap-2 mt-1.5">
            ${teamLogo ? `<img src="${teamLogo}" class="w-5 h-5 object-contain" />` : ''}
            <span class="font-mono text-xs text-ink-secondary">${p.currentTeam?.name || ''}</span>
            <span class="font-mono text-xs text-ink-muted">#${p.primaryNumber || ''} / ${p.primaryPosition?.name || ''}</span>
          </div>
        </div>
      </div>

      <!-- Bio -->
      <div class="rounded-2xl bg-surface-elevated/30 border border-ink-faint/8 p-4 divide-y divide-ink-faint/8">
        ${bio('Height', p.height)}
        ${bio('Weight', p.weight ? p.weight + ' lbs' : '')}
        ${bio('Age', `${p.currentAge || ''}${p.birthDate ? '  --  Born ' + p.birthDate : ''}`)}
        ${bio('Born in', `${p.birthCity || ''}${p.birthStateProvince ? ', ' + p.birthStateProvince : ''}, ${p.birthCountry || ''}`)}
        ${bio('Bats/Throws', `${p.batSide?.description || '?'} / ${p.pitchHand?.description || '?'}`)}
        ${bio('MLB Debut', p.mlbDebutDate || '')}
        ${bio('Active', p.active ? 'Yes' : 'No')}
      </div>

      <!-- Hitting Career -->
      ${hitCareer ? `
        ${section('Career Hitting')}
        <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
          ${numCard('G', hitCareer.gamesPlayed)}${numCard('AVG', hitCareer.avg)}${numCard('HR', hitCareer.homeRuns)}
          ${numCard('RBI', hitCareer.rbi)}${numCard('OPS', hitCareer.ops)}${numCard('SB', hitCareer.stolenBases)}
        </div>
      ` : ''}

      <!-- Pitching Career -->
      ${pitchCareer ? `
        ${section('Career Pitching')}
        <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
          ${numCard('G', pitchCareer.gamesPlayed)}${numCard('ERA', pitchCareer.era)}${numCard('W-L', (pitchCareer.wins || 0) + '-' + (pitchCareer.losses || 0))}
          ${numCard('SO', pitchCareer.strikeOuts)}${numCard('WHIP', pitchCareer.whip)}${numCard('SV', pitchCareer.saves)}
        </div>
      ` : ''}

      <!-- Hitting Year-by-Year -->
      ${isHitter && hitYby.length > 0 ? `
        ${section('Hitting by Season')}
        <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
          <table class="w-full text-sm font-mono tabular-nums min-w-[700px]">
            <thead><tr class="border-b border-ink-faint/10 bg-surface-elevated/30 text-[10px] text-ink-muted uppercase tracking-widest">
              <th class="text-left px-3 py-2">Year</th><th class="text-left px-2 py-2">Team</th>
              <th class="text-center px-2 py-2">G</th><th class="text-center px-2 py-2">AB</th>
              <th class="text-center px-2 py-2">R</th><th class="text-center px-2 py-2">H</th>
              <th class="text-center px-2 py-2">2B</th><th class="text-center px-2 py-2">HR</th>
              <th class="text-center px-2 py-2">RBI</th><th class="text-center px-2 py-2">SB</th>
              <th class="text-center px-2 py-2">BB</th><th class="text-center px-2 py-2">SO</th>
              <th class="text-center px-2 py-2 font-semibold text-accent">AVG</th>
              <th class="text-center px-2 py-2">OBP</th><th class="text-center px-2 py-2">SLG</th>
              <th class="text-center px-2 py-2">OPS</th>
            </tr></thead>
            <tbody>
              ${hitYby.map(s => { const t = s.stat; return `<tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/30">
                <td class="px-3 py-2 text-ink-secondary text-xs">${s.season}</td>
                <td class="px-2 py-2 text-ink-secondary text-xs">${s.team?.name || ''}</td>
                <td class="text-center px-2 py-2">${t.gamesPlayed ?? '-'}</td><td class="text-center px-2 py-2">${t.atBats ?? '-'}</td>
                <td class="text-center px-2 py-2">${t.runs ?? '-'}</td><td class="text-center px-2 py-2">${t.hits ?? '-'}</td>
                <td class="text-center px-2 py-2">${t.doubles ?? '-'}</td><td class="text-center px-2 py-2">${t.homeRuns ?? '-'}</td>
                <td class="text-center px-2 py-2">${t.rbi ?? '-'}</td><td class="text-center px-2 py-2">${t.stolenBases ?? '-'}</td>
                <td class="text-center px-2 py-2">${t.baseOnBalls ?? '-'}</td><td class="text-center px-2 py-2">${t.strikeOuts ?? '-'}</td>
                <td class="text-center px-2 py-2 font-semibold text-ink">${t.avg ?? '-'}</td>
                <td class="text-center px-2 py-2">${t.obp ?? '-'}</td><td class="text-center px-2 py-2">${t.slg ?? '-'}</td>
                <td class="text-center px-2 py-2">${t.ops ?? '-'}</td>
              </tr>`; }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- Pitching Year-by-Year -->
      ${isPitcher && pitchYby.length > 0 ? `
        ${section('Pitching by Season')}
        <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
          <table class="w-full text-sm font-mono tabular-nums min-w-[700px]">
            <thead><tr class="border-b border-ink-faint/10 bg-surface-elevated/30 text-[10px] text-ink-muted uppercase tracking-widest">
              <th class="text-left px-3 py-2">Year</th><th class="text-left px-2 py-2">Team</th>
              <th class="text-center px-2 py-2">G</th><th class="text-center px-2 py-2">GS</th>
              <th class="text-center px-2 py-2">W</th><th class="text-center px-2 py-2">L</th>
              <th class="text-center px-2 py-2 font-semibold text-accent">ERA</th>
              <th class="text-center px-2 py-2">IP</th><th class="text-center px-2 py-2">H</th>
              <th class="text-center px-2 py-2">ER</th><th class="text-center px-2 py-2">BB</th>
              <th class="text-center px-2 py-2">SO</th><th class="text-center px-2 py-2">WHIP</th>
              <th class="text-center px-2 py-2">SV</th>
            </tr></thead>
            <tbody>
              ${pitchYby.map(s => { const t = s.stat; return `<tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/30">
                <td class="px-3 py-2 text-ink-secondary text-xs">${s.season}</td>
                <td class="px-2 py-2 text-ink-secondary text-xs">${s.team?.name || ''}</td>
                <td class="text-center px-2 py-2">${t.gamesPlayed ?? '-'}</td><td class="text-center px-2 py-2">${t.gamesStarted ?? '-'}</td>
                <td class="text-center px-2 py-2">${t.wins ?? '-'}</td><td class="text-center px-2 py-2">${t.losses ?? '-'}</td>
                <td class="text-center px-2 py-2 font-semibold text-ink">${t.era ?? '-'}</td>
                <td class="text-center px-2 py-2">${t.inningsPitched ?? '-'}</td><td class="text-center px-2 py-2">${t.hits ?? '-'}</td>
                <td class="text-center px-2 py-2">${t.earnedRuns ?? '-'}</td><td class="text-center px-2 py-2">${t.baseOnBalls ?? '-'}</td>
                <td class="text-center px-2 py-2">${t.strikeOuts ?? '-'}</td><td class="text-center px-2 py-2">${t.whip ?? '-'}</td>
                <td class="text-center px-2 py-2">${t.saves ?? '-'}</td>
              </tr>`; }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- Game Log -->
      ${gameLog.length > 0 ? `
        ${section('2026 Game Log')}
        <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
          <table class="w-full text-sm font-mono tabular-nums min-w-[600px]">
            <thead><tr class="border-b border-ink-faint/10 bg-surface-elevated/30 text-[10px] text-ink-muted uppercase tracking-widest">
              <th class="text-left px-3 py-2">Date</th><th class="text-left px-2 py-2">Opp</th>
              <th class="text-center px-2 py-2">AB</th><th class="text-center px-2 py-2">R</th>
              <th class="text-center px-2 py-2">H</th><th class="text-center px-2 py-2">HR</th>
              <th class="text-center px-2 py-2">RBI</th><th class="text-center px-2 py-2">BB</th>
              <th class="text-center px-2 py-2">SO</th><th class="text-center px-2 py-2 font-semibold text-accent">AVG</th>
            </tr></thead>
            <tbody>
              ${gameLog.slice(0, 20).map(g => { const t = g.stat; return `<tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/30">
                <td class="px-3 py-2 text-ink-muted text-xs">${g.date || ''}</td>
                <td class="px-2 py-2 text-ink-secondary text-xs">${g.isHome ? 'vs' : '@'} ${g.opponent?.abbreviation || ''}</td>
                <td class="text-center px-2 py-2">${t.atBats ?? '-'}</td><td class="text-center px-2 py-2">${t.runs ?? '-'}</td>
                <td class="text-center px-2 py-2">${t.hits ?? '-'}</td><td class="text-center px-2 py-2">${t.homeRuns ?? '-'}</td>
                <td class="text-center px-2 py-2">${t.rbi ?? '-'}</td><td class="text-center px-2 py-2">${t.baseOnBalls ?? '-'}</td>
                <td class="text-center px-2 py-2">${t.strikeOuts ?? '-'}</td>
                <td class="text-center px-2 py-2 font-semibold text-ink">${t.avg ?? '-'}</td>
              </tr>`; }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- Awards -->
      ${Object.keys(awardMap).length > 0 ? `
        ${section('Awards')}
        <div class="space-y-1.5">
          ${Object.entries(awardMap).map(([name, years]) =>
            `<div class="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-elevated/30">
              <span class="font-sans text-sm text-ink">${name}</span>
              <span class="font-mono text-[10px] text-ink-muted">${years.sort().join(', ')}</span>
            </div>`
          ).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/* ── ESPN (NBA/NFL) ── */
async function loadEspn(sport, league, id) {
  const base = `https://site.web.api.espn.com/apis/common/v3/sports/${sport}/${league}/athletes/${id}`;
  const [bioRes, statsRes, overviewRes, logRes] = await Promise.all([
    fetch(base), fetch(`${base}/stats`), fetch(`${base}/overview`), fetch(`${base}/gamelog?season=2026`),
  ]);
  const bioData = await bioRes.json();
  const statsData = await statsRes.json();
  const overviewData = await overviewRes.json();
  const logData = await logRes.json();
  return { bio: bioData.athlete || bioData, stats: statsData, overview: overviewData, gamelog: logData };
}

function renderEspn(data, league) {
  const a = data.bio;
  const statsCategories = data.stats?.categories || [];
  const awards = data.overview?.awards || [];
  const injury = a.injuries?.[0];
  const summaryStats = a.statsSummary?.statistics || [];
  const hsUrl = hs(a.headshot?.href);
  const teamLogo = a.team?.logos?.[0]?.href || '';

  // Year-by-year: first category has the primary stats
  const primary = statsCategories[0];
  const labels = primary?.labels || [];
  const seasons = primary?.statistics || [];
  const totals = primary?.totals || [];

  // Game log
  const glLabels = data.gamelog?.labels || [];
  const glNames = data.gamelog?.names || [];
  const glEvents = data.gamelog?.seasonTypes?.flatMap(st => st.categories?.flatMap(c => c.events || []) || []) || [];

  return `
    <div class="px-5 sm:px-8 py-8">
      <!-- Header -->
      <div class="flex items-end gap-5 mb-6">
        ${hsUrl ? `<img src="${hsUrl}" class="w-24 h-24 rounded-2xl object-cover bg-surface-elevated shadow-diffused" onerror="this.style.display='none'" />` : `<div class="w-24 h-24 rounded-2xl bg-surface-elevated"></div>`}
        <div class="min-w-0 flex-1 pb-1">
          <h1 class="font-sans text-2xl sm:text-3xl font-bold text-ink leading-tight truncate">${a.displayName || '?'}</h1>
          <div class="flex items-center gap-2 mt-1.5">
            ${teamLogo ? `<img src="${teamLogo}" class="w-5 h-5 object-contain" />` : ''}
            <span class="font-mono text-xs text-ink-secondary">${a.team?.displayName || ''}</span>
            <span class="font-mono text-xs text-ink-muted">${a.displayJersey || ''} / ${a.position?.displayName || ''}</span>
          </div>
        </div>
      </div>

      <!-- Bio -->
      <div class="rounded-2xl bg-surface-elevated/30 border border-ink-faint/8 p-4 divide-y divide-ink-faint/8">
        ${bio('Height', a.displayHeight)}
        ${bio('Weight', a.displayWeight)}
        ${bio('Age', `${a.age || ''}${a.displayDOB ? '  --  Born ' + a.displayDOB : ''}`)}
        ${bio('Born in', a.displayBirthPlace)}
        ${bio('Draft', a.displayDraft)}
        ${bio('Experience', a.displayExperience)}
        ${a.college?.name ? bio('College', a.college.name) : ''}
      </div>

      <!-- Injury -->
      ${injury ? `
        <div class="mt-4 p-4 rounded-2xl bg-live-soft border border-live/15">
          <div class="font-mono text-[10px] text-live uppercase tracking-widest mb-1">Injury</div>
          <p class="font-sans text-sm text-ink-secondary leading-relaxed">${injury.longComment || injury.shortComment || ''}</p>
        </div>
      ` : ''}

      <!-- Current Season Summary -->
      ${summaryStats.length > 0 ? `
        ${section('Season Stats')}
        <div class="grid grid-cols-4 gap-2">
          ${summaryStats.map(s => numCard(s.abbreviation || s.shortDisplayName, s.displayValue)).join('')}
        </div>
        <div class="flex flex-wrap gap-2 mt-3">
          ${summaryStats.filter(s => s.rankDisplayValue).map(s =>
            `<span class="px-2.5 py-1 rounded-lg bg-surface-elevated font-mono text-[10px] text-ink-secondary">
              ${s.abbreviation}: <span class="text-accent font-semibold">${s.rankDisplayValue}</span> in ${league.toUpperCase()}
            </span>`
          ).join('')}
        </div>
      ` : ''}

      <!-- Year-by-Year -->
      ${seasons.length > 0 ? `
        ${section('Season History')}
        <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
          <table class="w-full text-sm font-mono tabular-nums">
            <thead><tr class="border-b border-ink-faint/10 bg-surface-elevated/30 text-[10px] text-ink-muted uppercase tracking-widest">
              <th class="text-left px-3 py-2">Season</th><th class="text-left px-2 py-2">Team</th>
              ${labels.map(l => `<th class="text-center px-2 py-2">${l}</th>`).join('')}
            </tr></thead>
            <tbody>
              ${seasons.map(s => `<tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/30">
                <td class="px-3 py-2 text-ink-secondary text-xs">${s.season?.displayName || ''}</td>
                <td class="px-2 py-2 text-ink-secondary text-xs">${s.teamSlug?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || ''}</td>
                ${(s.stats || []).map((v, i) => `<td class="text-center px-2 py-2 ${i === labels.length - 1 ? 'font-semibold text-ink' : ''}">${v}</td>`).join('')}
              </tr>`).join('')}
              ${totals.length ? `<tr class="border-t-2 border-ink-faint/20 font-semibold bg-surface-elevated/20">
                <td class="px-3 py-2 text-ink text-xs" colspan="2">Career</td>
                ${totals.map((v, i) => `<td class="text-center px-2 py-2 ${i === labels.length - 1 ? 'text-ink' : 'text-ink-secondary'}">${v}</td>`).join('')}
              </tr>` : ''}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- Game Log -->
      ${glEvents.length > 0 ? `
        ${section('Game Log')}
        <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
          <table class="w-full text-sm font-mono tabular-nums">
            <thead><tr class="border-b border-ink-faint/10 bg-surface-elevated/30 text-[10px] text-ink-muted uppercase tracking-widest">
              ${glLabels.map(l => `<th class="text-center px-2 py-2">${l}</th>`).join('')}
            </tr></thead>
            <tbody>
              ${glEvents.slice(0, 20).map(ev => `<tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/30">
                ${(ev.stats || []).map(v => `<td class="text-center px-2 py-2">${v}</td>`).join('')}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- Awards -->
      ${awards.length > 0 ? `
        ${section('Awards')}
        <div class="space-y-1.5">
          ${awards.map(a =>
            `<div class="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-elevated/30">
              <span class="font-sans text-sm text-ink">${a.name || 'Award'}</span>
              <span class="font-mono text-[10px] text-ink-muted">${(a.seasons || []).join(', ')} ${a.displayCount ? '(' + a.displayCount + ')' : ''}</span>
            </div>`
          ).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/* ── Page Component ── */
export function PlayerPage(container, params, query) {
  const id = params.id;
  const league = query.league || 'nba';
  const name = query.name || '';

  container.innerHTML = `<div class="max-w-3xl mx-auto">${skeleton()}</div>`;

  async function load() {
    try {
      let html = '';

      if (league === 'nhl') {
        const data = await loadNhl(name || id);
        html = renderNhl(data);
      } else if (league === 'mlb') {
        const data = await loadMlb(id);
        if (!data) throw new Error('Not found');
        html = renderMlb(data);
      } else {
        const sport = league === 'nfl' ? 'football' : 'basketball';
        const data = await loadEspn(sport, league, id);
        html = renderEspn(data, league);
      }

      container.innerHTML = `
        <div class="max-w-3xl mx-auto">
          <div class="pt-4 px-4 sm:px-0 mb-2">
            <a href="#/stats" class="inline-flex items-center gap-2 font-mono text-[11px] uppercase
                              tracking-widest text-ink-muted hover:text-ink
                              transition-colors duration-300 no-underline group">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                   class="transition-transform duration-300 group-hover:-translate-x-0.5">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Stats
            </a>
          </div>
          <div class="rounded-3xl bg-surface-card border border-ink-faint/15 shadow-diffused overflow-hidden opacity-0 animate-fade-up">
            ${html}
          </div>
        </div>
      `;
    } catch (err) {
      console.error('Player page error:', err);
      container.innerHTML = `
        <div class="max-w-3xl mx-auto pt-8 text-center">
          <p class="font-mono text-sm text-ink-muted mb-4">Player not found</p>
          <a href="#/stats" class="font-mono text-xs text-accent hover:underline">Back to Stats</a>
        </div>
      `;
    }
  }

  load();
  return () => {};
}
