/**
 * Player profile page — full bio, year-by-year stats, game log, awards.
 * NHL: api-web.nhle.com, MLB: statsapi.mlb.com, NBA/NFL: ESPN.
 */

import { enableTableSort } from '../lib/table-sort.js';

/* ── Shared helpers ── */
function espnHs(url, size = 200) {
  if (!url) return '';
  if (url.includes('espncdn.com')) return `https://a.espncdn.com/combiner/i?img=${url.replace(/^https?:\/\/a\.espncdn\.com/, '')}&w=${size}&h=${size}`;
  return url;
}
function espnTeamLogo(sport, teamId, size = 32) {
  if (!teamId) return '';
  return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/${sport}/500/${teamId}.png&h=${size}&w=${size}`;
}
function teamNameFromSlug(slug) {
  if (!slug || slug.includes('Total')) return '';
  const parts = slug.split('-');
  return parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1);
}
function logoImg(src, cls = 'w-5 h-5') {
  if (!src) return '';
  return `<img src="${src}" class="${cls} object-contain shrink-0" loading="lazy" onerror="this.style.display='none'" />`;
}
function sec(title) {
  return `<div class="font-mono text-[10px] text-ink-muted uppercase tracking-[0.1em] mt-8 mb-3 flex items-center gap-2">${title}<span class="flex-1 h-px bg-ink-faint/15"></span></div>`;
}
function stat(label, value, rank) {
  return `<div class="text-center">
    <div class="font-mono text-xl sm:text-2xl font-bold text-ink tabular-nums leading-none">${value ?? '-'}</div>
    <div class="font-mono text-[9px] text-ink-muted uppercase tracking-widest mt-1">${label}</div>
    ${rank ? `<div class="font-mono text-[9px] text-accent font-semibold mt-0.5">${rank}</div>` : ''}
  </div>`;
}
function th(label, opts = '') {
  return `<th class="text-center px-2 py-2 whitespace-nowrap ${opts}">${label}</th>`;
}
function td(value, opts = '') {
  return `<td class="text-center px-2 py-2 whitespace-nowrap ${opts}">${value ?? '-'}</td>`;
}
function skeleton() {
  return `<div class="max-w-3xl mx-auto pt-6"><div class="rounded-3xl bg-surface-card border border-ink-faint/15 overflow-hidden">
    <div class="p-6 sm:p-8 space-y-6 opacity-0 animate-fade-up">
      <div class="flex gap-5"><div class="skeleton w-24 h-24 rounded-2xl shrink-0"></div><div class="flex-1 space-y-3 pt-2"><div class="skeleton h-7 w-48"></div><div class="skeleton h-4 w-36"></div><div class="skeleton h-3 w-64"></div></div></div>
      <div class="grid grid-cols-4 sm:grid-cols-6 gap-4">${'<div class="skeleton h-14 rounded-xl"></div>'.repeat(6)}</div>
      <div class="skeleton h-72 rounded-2xl"></div>
    </div>
  </div></div>`;
}
function backLink() {
  return `<a href="#/stats" class="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-ink-muted hover:text-ink transition-colors no-underline group">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="transition-transform duration-300 group-hover:-translate-x-0.5"><path d="m15 18-6-6 6-6"/></svg>Stats
  </a>`;
}

function header(hsUrl, name, teamLogo, teamName, details) {
  return `<div class="flex gap-5 mb-6">
    ${hsUrl ? `<img src="${hsUrl}" class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover bg-surface-elevated shadow-card shrink-0" onerror="this.style.display='none'" />` : `<div class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-surface-elevated shrink-0"></div>`}
    <div class="min-w-0 flex-1 pt-1">
      <h1 class="font-sans text-2xl sm:text-3xl font-bold text-ink leading-tight">${name}</h1>
      <div class="flex items-center gap-2 mt-1.5 flex-wrap">
        ${logoImg(teamLogo, 'w-5 h-5')}
        <span class="font-sans text-sm text-ink-secondary font-medium">${teamName}</span>
      </div>
      <div class="font-mono text-[11px] text-ink-muted mt-1.5 leading-relaxed">${details}</div>
    </div>
  </div>`;
}

function bioGrid(items) {
  const filtered = items.filter(x => x[1]);
  if (!filtered.length) return '';
  return `<div class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 py-4 border-y border-ink-faint/8">
    ${filtered.map(([label, value]) => `<div>
      <div class="font-mono text-[9px] text-ink-muted uppercase tracking-widest">${label}</div>
      <div class="font-sans text-sm text-ink">${value}</div>
    </div>`).join('')}
  </div>`;
}

function awardBadges(awards) {
  if (!awards.length) return '';
  return `${sec('Awards')}<div class="flex flex-wrap gap-1.5">${awards.map(a =>
    `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent-soft/60 border border-accent/10 font-mono text-[10px] text-accent font-medium">${a.name}${a.count > 1 ? ' <span class="opacity-60">x' + a.count + '</span>' : ''}</span>`
  ).join('')}</div>`;
}

/* ── NHL team name → abbreviation map ── */
const NHL_ABBR = {"Colorado Avalanche":"COL","Carolina Hurricanes":"CAR","Tampa Bay Lightning":"TBL","Dallas Stars":"DAL","Buffalo Sabres":"BUF","Montréal Canadiens":"MTL","Minnesota Wild":"MIN","Pittsburgh Penguins":"PIT","Boston Bruins":"BOS","Ottawa Senators":"OTT","Philadelphia Flyers":"PHI","New York Islanders":"NYI","Detroit Red Wings":"DET","Columbus Blue Jackets":"CBJ","Edmonton Oilers":"EDM","Anaheim Ducks":"ANA","Washington Capitals":"WSH","Utah Mammoth":"UTA","Vegas Golden Knights":"VGK","New Jersey Devils":"NJD","Los Angeles Kings":"LAK","Nashville Predators":"NSH","San Jose Sharks":"SJS","Winnipeg Jets":"WPG","St. Louis Blues":"STL","Toronto Maple Leafs":"TOR","Florida Panthers":"FLA","Seattle Kraken":"SEA","New York Rangers":"NYR","Calgary Flames":"CGY","Chicago Blackhawks":"CHI","Vancouver Canucks":"VAN","Arizona Coyotes":"ARI","Atlanta Thrashers":"ATL","Hartford Whalers":"HFD","Quebec Nordiques":"QUE","Mighty Ducks of Anaheim":"ANA","Phoenix Coyotes":"ARI"};
function nhlTeamLogo(teamName) {
  const abbr = NHL_ABBR[teamName] || '';
  if (!abbr) return '';
  return `https://assets.nhle.com/logos/nhl/svg/${abbr}_light.svg`;
}

/* ══════════════════════════════════════════════
   NHL
   ══════════════════════════════════════════════ */
async function loadNhl(name) {
  const sr = await fetch(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=1&q=${encodeURIComponent(name)}&active=true`);
  const sd = await sr.json();
  if (!sd?.[0]?.playerId) throw new Error('Not found');
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
  const rawAwards = p.awards || [];
  const awards = rawAwards.map(a => ({ name: a.trophy?.default || 'Award', count: a.seasons?.length || 1 }));

  const details = [
    `#${p.sweaterNumber || ''}`,
    p.position || '',
    `${p.heightInCentimeters || ''}cm / ${p.heightInInches || ''}"`,
    `${p.weightInPounds || ''} lbs`,
    age ? `Age ${age}` : '',
  ].filter(Boolean).join('  /  ');

  return `
    ${p.heroImage ? `<div class="relative h-44 sm:h-56 overflow-hidden bg-ink/80">
      <img src="${p.heroImage}" class="w-full h-full object-cover object-top" onerror="this.parentElement.remove()" />
      <div class="absolute inset-0 bg-gradient-to-t from-surface-card via-surface-card/30 to-transparent"></div>
    </div>` : ''}

    <div class="p-5 sm:p-8 ${p.heroImage ? '-mt-16 relative' : ''}">
      ${header(p.headshot, name, p.teamLogo, p.fullTeamName?.default || '', details)}

      ${bioGrid([
        ['Born', p.birthDate || ''],
        ['Birthplace', `${p.birthCity?.default || ''}${p.birthStateProvince?.default ? ', ' + p.birthStateProvince.default : ''}`],
        ['Nationality', p.birthCountry || ''],
        ['Shoots', p.shootsCatches === 'L' ? 'Left' : p.shootsCatches === 'R' ? 'Right' : ''],
        ['Draft', draft ? `${draft.year} R${draft.round} P${draft.pickInRound} (#${draft.overallPick}) ${draft.teamAbbrev}` : 'Undrafted'],
        ['HOF', p.inHHOF ? 'Inducted' : ''],
      ])}

      ${sec('2025-26 Season')}
      <div class="grid grid-cols-4 sm:grid-cols-8 gap-4 sm:gap-6">
        ${stat('GP', cs.gamesPlayed)}${stat('G', cs.goals)}${stat('A', cs.assists)}${stat('PTS', cs.points)}
        ${stat('+/-', cs.plusMinus)}${stat('PIM', cs.pim)}${stat('PPG', cs.powerPlayGoals)}${stat('S', cs.shots)}
      </div>

      ${sec('Career')}
      <div class="grid grid-cols-4 sm:grid-cols-8 gap-4 sm:gap-6">
        ${stat('GP', career.gamesPlayed)}${stat('G', career.goals)}${stat('A', career.assists)}
        ${stat('PTS', (career.goals || 0) + (career.assists || 0))}${stat('+/-', career.plusMinus)}
        ${stat('GWG', career.gameWinningGoals)}
        ${stat('S%', career.shootingPctg != null ? (career.shootingPctg * 100).toFixed(1) : '-')}
        ${stat('TOI/G', career.avgToi || '-')}
      </div>

      ${seasons.length > 0 ? `
        ${sec('Season History')}
        <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
          <table class="w-full text-[12px] font-mono tabular-nums">
            <thead><tr class="border-b border-ink-faint/10 bg-surface-elevated/40 text-[9px] text-ink-muted uppercase tracking-widest">
              <th class="text-left px-3 py-2 sticky left-0 bg-surface-elevated/40">Season</th>
              <th class="text-left px-2 py-2">Team</th>
              ${th('GP')}${th('G')}${th('A')}${th('PTS', 'font-semibold text-accent')}${th('+/-')}${th('PIM')}
              ${th('PPG', 'hidden sm:table-cell')}${th('S', 'hidden sm:table-cell')}
              ${th('S%', 'hidden sm:table-cell')}${th('TOI/G', 'hidden md:table-cell')}
            </tr></thead>
            <tbody>
              ${seasons.map(s => {
                const yr = String(s.season); const display = yr.slice(0, 4) + '-' + yr.slice(6);
                const tName = s.teamName?.default || '';
                const tAbbr = NHL_ABBR[tName] || '';
                const tLogo = nhlTeamLogo(tName);
                return `<tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/30">
                  <td class="px-3 py-2 text-ink-muted text-[11px] sticky left-0 bg-surface-card whitespace-nowrap">${display}</td>
                  <td class="px-2 py-2 whitespace-nowrap"><div class="flex items-center gap-1.5">${logoImg(tLogo, 'w-4 h-4')}<span class="text-ink-secondary text-[11px]">${tAbbr}</span></div></td>
                  ${td(s.gamesPlayed)}${td(s.goals)}${td(s.assists)}${td((s.goals||0)+(s.assists||0), 'font-semibold text-ink')}
                  ${td(s.plusMinus)}${td(s.pim)}
                  ${td(s.powerPlayGoals, 'hidden sm:table-cell')}${td(s.shots, 'hidden sm:table-cell')}
                  ${td(s.shootingPctg != null ? (s.shootingPctg*100).toFixed(1) : '-', 'hidden sm:table-cell')}
                  ${td(s.avgToi || '-', 'hidden md:table-cell')}
                </tr>`; }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${last5.length > 0 ? `
        ${sec('Recent Games')}
        <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
          <table class="w-full text-[12px] font-mono tabular-nums">
            <thead><tr class="border-b border-ink-faint/10 bg-surface-elevated/40 text-[9px] text-ink-muted uppercase tracking-widest">
              <th class="text-left px-3 py-2">Date</th><th class="text-center px-2 py-2">Opp</th>
              ${th('G')}${th('A')}${th('PTS', 'font-semibold text-accent')}${th('+/-')}${th('S')}${th('TOI')}
            </tr></thead>
            <tbody>${last5.map(g => `<tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/30">
              <td class="px-3 py-2 text-ink-muted whitespace-nowrap">${g.gameDate || ''}</td>
              <td class="text-center px-2 py-2 text-ink-secondary whitespace-nowrap">${g.homeRoadFlag === 'H' ? 'vs' : '@'} ${g.opponentAbbrev || ''}</td>
              ${td(g.goals)}${td(g.assists)}${td(g.points, 'font-semibold text-ink')}${td(g.plusMinus)}${td(g.shots)}${td(g.toi)}
            </tr>`).join('')}</tbody>
          </table>
        </div>
      ` : ''}

      ${awardBadges(awards)}
    </div>
  `;
}

/* ══════════════════════════════════════════════
   MLB
   ══════════════════════════════════════════════ */
async function loadMlb(id) {
  const [pRes, logRes] = await Promise.all([
    fetch(`https://statsapi.mlb.com/api/v1/people/${id}?hydrate=stats(group=[hitting,pitching,fielding],type=[yearByYear,career]),awards,currentTeam`),
    fetch(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=gameLog&season=2026&group=hitting`),
  ]);
  const person = (await pRes.json()).people?.[0];
  if (person) person._gameLog = (await logRes.json()).stats?.[0]?.splits || [];
  return person;
}

function renderMlb(p) {
  const hsUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_200,q_auto:best/v1/people/${p.id}/headshot/67/current`;
  const teamLogo = p.currentTeam?.id ? `https://www.mlbstatic.com/team-logos/${p.currentTeam.id}.svg` : '';

  const getStat = (group, type) => p.stats?.find(s => s.group?.displayName === group && s.type?.displayName === type);
  const hitYby = getStat('hitting', 'yearByYear')?.splits || [];
  const pitchYby = getStat('pitching', 'yearByYear')?.splits || [];
  const hitCareer = getStat('hitting', 'career')?.splits?.[0]?.stat;
  const pitchCareer = getStat('pitching', 'career')?.splits?.[0]?.stat;
  const gameLog = p._gameLog || [];

  const rawAwards = p.awards || [];
  const awardMap = {};
  rawAwards.forEach(a => { const n = a.name || 'Award'; awardMap[n] = (awardMap[n] || 0) + 1; });
  const awards = Object.entries(awardMap).map(([name, count]) => ({ name, count }));

  const details = [
    `#${p.primaryNumber || ''}`,
    p.primaryPosition?.name || '',
    p.height || '',
    p.weight ? p.weight + ' lbs' : '',
    p.currentAge ? 'Age ' + p.currentAge : '',
  ].filter(Boolean).join('  /  ');

  return `
    <div class="p-5 sm:p-8">
      ${header(hsUrl, p.fullName || '?', teamLogo, p.currentTeam?.name || '', details)}

      ${bioGrid([
        ['Born', p.birthDate || ''],
        ['Birthplace', `${p.birthCity || ''}${p.birthStateProvince ? ', ' + p.birthStateProvince : ''}`],
        ['Nationality', p.birthCountry || ''],
        ['Bats / Throws', `${p.batSide?.description || '?'} / ${p.pitchHand?.description || '?'}`],
        ['MLB Debut', p.mlbDebutDate || ''],
        ['Status', p.active ? 'Active' : 'Inactive'],
      ])}

      ${hitCareer ? `${sec('Career Hitting')}
        <div class="grid grid-cols-4 sm:grid-cols-6 gap-4 sm:gap-6">
          ${stat('G', hitCareer.gamesPlayed)}${stat('AVG', hitCareer.avg)}${stat('HR', hitCareer.homeRuns)}
          ${stat('RBI', hitCareer.rbi)}${stat('OPS', hitCareer.ops)}${stat('SB', hitCareer.stolenBases)}
        </div>` : ''}

      ${pitchCareer ? `${sec('Career Pitching')}
        <div class="grid grid-cols-4 sm:grid-cols-6 gap-4 sm:gap-6">
          ${stat('G', pitchCareer.gamesPlayed)}${stat('ERA', pitchCareer.era)}
          ${stat('W-L', (pitchCareer.wins||0)+'-'+(pitchCareer.losses||0))}
          ${stat('SO', pitchCareer.strikeOuts)}${stat('WHIP', pitchCareer.whip)}${stat('SV', pitchCareer.saves)}
        </div>` : ''}

      ${hitYby.length > 0 ? `${sec('Hitting by Season')}
        <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
          <table class="w-full text-[12px] font-mono tabular-nums">
            <thead><tr class="border-b border-ink-faint/10 bg-surface-elevated/40 text-[9px] text-ink-muted uppercase tracking-widest">
              <th class="text-left px-3 py-2 sticky left-0 bg-surface-elevated/40">Year</th>
              <th class="text-left px-2 py-2">Team</th>
              ${th('G')}${th('AB')}${th('H')}${th('HR')}${th('RBI')}${th('SB', 'hidden sm:table-cell')}
              ${th('BB', 'hidden md:table-cell')}${th('SO', 'hidden md:table-cell')}
              ${th('AVG', 'font-semibold text-accent')}${th('OBP', 'hidden sm:table-cell')}
              ${th('SLG', 'hidden sm:table-cell')}${th('OPS')}
            </tr></thead>
            <tbody>
              ${hitYby.map(s => { const t = s.stat; const tl = s.team?.id ? `https://www.mlbstatic.com/team-logos/${s.team.id}.svg` : '';
                return `<tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/30">
                  <td class="px-3 py-2 text-ink-muted text-[11px] sticky left-0 bg-surface-card whitespace-nowrap">${s.season}</td>
                  <td class="px-2 py-2 whitespace-nowrap"><div class="flex items-center gap-1.5">${logoImg(tl, 'w-4 h-4')}<span class="text-ink-secondary text-[11px]">${s.team?.abbreviation || s.team?.name || ''}</span></div></td>
                  ${td(t.gamesPlayed)}${td(t.atBats)}${td(t.hits)}${td(t.homeRuns)}${td(t.rbi)}
                  ${td(t.stolenBases, 'hidden sm:table-cell')}${td(t.baseOnBalls, 'hidden md:table-cell')}${td(t.strikeOuts, 'hidden md:table-cell')}
                  ${td(t.avg, 'font-semibold text-ink')}${td(t.obp, 'hidden sm:table-cell')}
                  ${td(t.slg, 'hidden sm:table-cell')}${td(t.ops)}
                </tr>`; }).join('')}
            </tbody>
          </table>
        </div>` : ''}

      ${pitchYby.length > 0 ? `${sec('Pitching by Season')}
        <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
          <table class="w-full text-[12px] font-mono tabular-nums">
            <thead><tr class="border-b border-ink-faint/10 bg-surface-elevated/40 text-[9px] text-ink-muted uppercase tracking-widest">
              <th class="text-left px-3 py-2 sticky left-0 bg-surface-elevated/40">Year</th>
              <th class="text-left px-2 py-2">Team</th>
              ${th('G')}${th('GS', 'hidden sm:table-cell')}${th('W')}${th('L')}
              ${th('ERA', 'font-semibold text-accent')}${th('IP')}${th('SO')}
              ${th('BB', 'hidden sm:table-cell')}${th('WHIP')}${th('SV', 'hidden md:table-cell')}
            </tr></thead>
            <tbody>
              ${pitchYby.map(s => { const t = s.stat; const tl = s.team?.id ? `https://www.mlbstatic.com/team-logos/${s.team.id}.svg` : '';
                return `<tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/30">
                  <td class="px-3 py-2 text-ink-muted text-[11px] sticky left-0 bg-surface-card whitespace-nowrap">${s.season}</td>
                  <td class="px-2 py-2 whitespace-nowrap"><div class="flex items-center gap-1.5">${logoImg(tl, 'w-4 h-4')}<span class="text-ink-secondary text-[11px]">${s.team?.abbreviation || s.team?.name || ''}</span></div></td>
                  ${td(t.gamesPlayed)}${td(t.gamesStarted, 'hidden sm:table-cell')}${td(t.wins)}${td(t.losses)}
                  ${td(t.era, 'font-semibold text-ink')}${td(t.inningsPitched)}${td(t.strikeOuts)}
                  ${td(t.baseOnBalls, 'hidden sm:table-cell')}${td(t.whip)}${td(t.saves, 'hidden md:table-cell')}
                </tr>`; }).join('')}
            </tbody>
          </table>
        </div>` : ''}

      ${gameLog.length > 0 ? `${sec('2026 Game Log')}
        <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
          <table class="w-full text-[12px] font-mono tabular-nums">
            <thead><tr class="border-b border-ink-faint/10 bg-surface-elevated/40 text-[9px] text-ink-muted uppercase tracking-widest">
              <th class="text-left px-3 py-2">Date</th><th class="text-center px-2 py-2">Opp</th>
              ${th('AB')}${th('R')}${th('H')}${th('HR')}${th('RBI')}${th('BB', 'hidden sm:table-cell')}${th('SO', 'hidden sm:table-cell')}${th('AVG', 'font-semibold text-accent')}
            </tr></thead>
            <tbody>${gameLog.slice(0, 20).map(g => { const t = g.stat; return `<tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/30">
              <td class="px-3 py-2 text-ink-muted whitespace-nowrap">${g.date || ''}</td>
              <td class="text-center px-2 py-2 text-ink-secondary whitespace-nowrap">${g.isHome ? 'vs' : '@'} ${g.opponent?.abbreviation || ''}</td>
              ${td(t.atBats)}${td(t.runs)}${td(t.hits)}${td(t.homeRuns)}${td(t.rbi)}
              ${td(t.baseOnBalls, 'hidden sm:table-cell')}${td(t.strikeOuts, 'hidden sm:table-cell')}${td(t.avg, 'font-semibold text-ink')}
            </tr>`; }).join('')}</tbody>
          </table>
        </div>` : ''}

      ${awardBadges(awards)}
    </div>
  `;
}

/* ── ESPN compound stat splitter ──
   ESPN returns "FG" as "10.8-22.8" (made-attempted). Split into FGM/FGA columns. */
const SPLIT_MAP = { 'FG': ['FGM', 'FGA'], '3PT': ['3PM', '3PA'], 'FT': ['FTM', 'FTA'] };
function expandLabelsAndStats(labels, statsRows, totalsRow) {
  const newLabels = [];
  const expandIndices = []; // [origIdx, splitLabel1, splitLabel2] or [origIdx, null]
  labels.forEach((l, i) => {
    if (SPLIT_MAP[l]) {
      newLabels.push(SPLIT_MAP[l][0], SPLIT_MAP[l][1]);
      expandIndices.push([i, true]);
    } else {
      newLabels.push(l);
      expandIndices.push([i, false]);
    }
  });

  function expandRow(stats) {
    const out = [];
    expandIndices.forEach(([i, split]) => {
      const v = stats[i] ?? '-';
      if (split) {
        const parts = String(v).split('-');
        out.push(parts[0] ?? '-', parts[1] ?? '-');
      } else {
        out.push(v);
      }
    });
    return out;
  }

  return {
    labels: newLabels,
    seasons: statsRows.map(s => ({ ...s, stats: expandRow(s.stats || []) })),
    totals: totalsRow ? expandRow(totalsRow) : [],
  };
}

/* ══════════════════════════════════════════════
   ESPN (NBA / NFL)
   ══════════════════════════════════════════════ */
async function loadEspn(sport, league, id) {
  const base = `https://site.web.api.espn.com/apis/common/v3/sports/${sport}/${league}/athletes/${id}`;
  const [bioRes, statsRes, overviewRes, logRes] = await Promise.all([
    fetch(base), fetch(`${base}/stats`), fetch(`${base}/overview`), fetch(`${base}/gamelog?season=2026`),
  ]);
  return {
    bio: ((await bioRes.json()).athlete || {}),
    stats: await statsRes.json(),
    overview: await overviewRes.json(),
    gamelog: await logRes.json(),
    sport, league,
  };
}

function renderEspn(data) {
  const { bio: a, stats: statsData, overview, gamelog, sport, league } = data;
  const statsCategories = statsData?.categories || [];
  const injury = a.injuries?.[0];
  const summaryStats = a.statsSummary?.statistics || [];
  const hsUrl = espnHs(a.headshot?.href);
  const teamLogo = a.team?.logos?.[0]?.href || '';

  const primary = statsCategories[0];
  const rawLabels = primary?.labels || [];
  const rawSeasons = (primary?.statistics || []).filter(s => !s.displayName?.includes('Total'));
  const rawTotals = primary?.totals || [];
  const exp = expandLabelsAndStats(rawLabels, rawSeasons, rawTotals);
  const labels = exp.labels;
  const seasons = exp.seasons;
  const totals = exp.totals;

  const rawGlLabels = gamelog?.labels || [];
  const rawGlEvents = gamelog?.seasonTypes?.flatMap(st => st.categories?.flatMap(c => c.events || []) || []) || [];
  const glExp = expandLabelsAndStats(rawGlLabels, rawGlEvents.map(ev => ({ stats: ev.stats })), null);
  const glLabels = glExp.labels;
  const glEvents = glExp.seasons.map((s, i) => ({ ...rawGlEvents[i], stats: s.stats }));

  const rawAwards = overview?.awards || [];
  const awards = rawAwards.map(a => ({ name: a.name || 'Award', count: parseInt(a.displayCount) || 1 }));

  const details = [
    a.displayJersey || '',
    a.position?.displayName || '',
    a.displayHeight || '',
    a.displayWeight || '',
    a.age ? 'Age ' + a.age : '',
  ].filter(Boolean).join('  /  ');

  return `
    <div class="p-5 sm:p-8">
      ${header(hsUrl, a.displayName || '?', teamLogo, a.team?.displayName || '', details)}

      ${bioGrid([
        ['Born', a.displayDOB || ''],
        ['Birthplace', a.displayBirthPlace || ''],
        ['Draft', a.displayDraft || ''],
        ['Experience', a.displayExperience || ''],
        ['College', a.college?.name || ''],
        ['Status', a.status?.type || ''],
      ])}

      ${injury ? `<div class="mt-4 p-4 rounded-2xl bg-live-soft/50 border border-live/10">
        <div class="font-mono text-[10px] text-live uppercase tracking-widest mb-1 font-semibold">Injury</div>
        <p class="font-sans text-sm text-ink-secondary leading-relaxed">${injury.longComment || injury.shortComment || ''}</p>
      </div>` : ''}

      ${summaryStats.length > 0 ? `${sec('Season Stats')}
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          ${summaryStats.map(s => stat(s.abbreviation || s.shortDisplayName, s.displayValue, s.rankDisplayValue ? s.rankDisplayValue + ' in ' + league.toUpperCase() : '')).join('')}
        </div>` : ''}

      ${seasons.length > 0 ? `${sec('Season History')}
        <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
          <table class="w-full text-[12px] font-mono tabular-nums">
            <thead><tr class="border-b border-ink-faint/10 bg-surface-elevated/40 text-[9px] text-ink-muted uppercase tracking-widest">
              <th class="text-left px-3 py-2 sticky left-0 bg-surface-elevated/40 whitespace-nowrap">Season</th>
              <th class="text-left px-2 py-2 whitespace-nowrap">Team</th>
              ${labels.map(l => `<th class="text-center px-1.5 py-2 whitespace-nowrap">${l}</th>`).join('')}
            </tr></thead>
            <tbody>
              ${seasons.map(s => {
                const logo = s.teamId ? espnTeamLogo(sport === 'football' ? 'nfl' : sport === 'basketball' ? 'nba' : 'nhl', s.teamId, 20) : '';
                const tName = teamNameFromSlug(s.teamSlug);
                return `<tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/30">
                  <td class="px-3 py-2 text-ink-muted text-[11px] sticky left-0 bg-surface-card whitespace-nowrap">${s.season?.displayName || ''}</td>
                  <td class="px-2 py-2 whitespace-nowrap"><div class="flex items-center gap-1.5">${logoImg(logo, 'w-4 h-4')}<span class="text-ink-secondary text-[11px]">${tName}</span></div></td>
                  ${(s.stats || []).map(v => `<td class="text-center px-1.5 py-2 whitespace-nowrap">${v}</td>`).join('')}
                </tr>`;
              }).join('')}
              ${totals.length ? `<tr class="border-t-2 border-ink-faint/15 font-semibold bg-surface-elevated/20" data-sort-pin>
                <td class="px-3 py-2.5 text-ink text-[11px] sticky left-0 bg-surface-elevated/20 whitespace-nowrap" colspan="2">Career</td>
                ${totals.map(v => `<td class="text-center px-1.5 py-2.5 whitespace-nowrap text-ink">${v}</td>`).join('')}
              </tr>` : ''}
            </tbody>
          </table>
        </div>` : ''}

      ${glEvents.length > 0 ? `${sec('Game Log')}
        <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
          <table class="w-full text-[12px] font-mono tabular-nums">
            <thead><tr class="border-b border-ink-faint/10 bg-surface-elevated/40 text-[9px] text-ink-muted uppercase tracking-widest">
              ${glLabels.map(l => `<th class="text-center px-1.5 py-2 whitespace-nowrap">${l}</th>`).join('')}
            </tr></thead>
            <tbody>${glEvents.slice(0, 20).map(ev =>
              `<tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/30">
                ${(ev.stats || []).map(v => `<td class="text-center px-1.5 py-2 whitespace-nowrap">${v}</td>`).join('')}
              </tr>`
            ).join('')}</tbody>
          </table>
        </div>` : ''}

      ${awardBadges(awards)}
    </div>
  `;
}

/* ══════════════════════════════════════════════
   Page Component
   ══════════════════════════════════════════════ */
export function PlayerPage(container, params, query) {
  const id = params.id;
  const league = query.league || 'nba';
  const name = query.name || '';

  container.innerHTML = skeleton();

  async function load() {
    try {
      let html = '';

      if (league === 'nhl') {
        html = renderNhl(await loadNhl(name || id));
      } else if (league === 'mlb') {
        const data = await loadMlb(id);
        if (!data) throw new Error('Not found');
        html = renderMlb(data);
      } else {
        const sport = league === 'nfl' ? 'football' : 'basketball';
        html = renderEspn(await loadEspn(sport, league, id));
      }

      container.innerHTML = `
        <div class="max-w-3xl mx-auto pt-4 pb-12">
          <div class="px-4 sm:px-0 mb-3">${backLink()}</div>
          <div class="rounded-3xl bg-surface-card border border-ink-faint/15 shadow-diffused overflow-hidden opacity-0 animate-fade-up">
            ${html}
          </div>
        </div>
      `;
      enableTableSort(container);
    } catch (err) {
      console.error('Player page error:', err);
      container.innerHTML = `<div class="max-w-3xl mx-auto pt-8 text-center">
        <p class="font-mono text-sm text-ink-muted mb-4">Player not found</p>
        <a href="#/stats" class="font-mono text-xs text-accent hover:underline">Back to Stats</a>
      </div>`;
    }
  }

  load();
  return () => {};
}
