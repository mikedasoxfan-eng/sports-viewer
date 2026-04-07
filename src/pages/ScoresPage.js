/**
 * Scores page — expandable game cards with full box scores, plays, game info.
 * ESPN summary for NBA/NFL/NHL, MLB live feed for baseball.
 */

import { state } from '../lib/state.js';
import { SUPPORTED_LEAGUES, getLeagueName, LEAGUE_CONFIGS } from '../config.js';
import { delegate } from '../lib/dom.js';
import { enableTableSort } from '../lib/table-sort.js';

/* ── Endpoints ── */
const ESPN_SB = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
};
const ESPN_SUMMARY = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary',
};
const MLB_SCHED = 'https://statsapi.mlb.com/api/v1/schedule';

/* ── Helpers ── */
function pad(n) { return String(n).padStart(2, '0'); }
function espnDate(d) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; }
function mlbDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function dayLabel(d) {
  const today = new Date(); today.setHours(0,0,0,0);
  const cmp = new Date(d); cmp.setHours(0,0,0,0);
  const diff = Math.round((cmp - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function shiftDay(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function espnLogo(t) { return t?.logo || t?.team?.logo || ''; }
function optHs(url) {
  if (!url) return '';
  if (url.includes('espncdn.com')) return `https://a.espncdn.com/combiner/i?img=${url.replace(/^https?:\/\/a\.espncdn\.com/, '')}&w=96&h=96`;
  return url;
}
function spinner() { return `<div class="flex justify-center py-16"><div class="w-6 h-6 border-2 border-ink-faint border-t-ink rounded-full animate-[spin_0.8s_linear_infinite]"></div></div>`; }
function miniSpinner() { return `<div class="flex justify-center py-8"><div class="w-5 h-5 border-2 border-ink-faint border-t-ink rounded-full animate-[spin_0.8s_linear_infinite]"></div></div>`; }

/* ── Fetch ── */
async function fetchEspn(league, date) {
  const res = await fetch(`${ESPN_SB[league]}?dates=${espnDate(date)}`);
  if (!res.ok) return [];
  return ((await res.json()).events || []).map(ev => ({ ...ev, _league: league }));
}
async function fetchMlb(date) {
  try {
    const res = await fetch(`${MLB_SCHED}?sportId=1&date=${mlbDate(date)}&hydrate=linescore,team,probablePitcher,stats,broadcasts`);
    if (!res.ok) return [];
    return ((await res.json()).dates?.[0]?.games || []).map(g => ({ ...g, _league: 'mlb' }));
  } catch { return fetchEspn('mlb', date); }
}
async function fetchEspnSummary(league, eventId) {
  const res = await fetch(`${ESPN_SUMMARY[league]}?event=${eventId}`);
  return res.ok ? res.json() : null;
}
async function fetchMlbFeed(gamePk) {
  const res = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`);
  return res.ok ? res.json() : null;
}

/* ══════════════════════════════════════════════
   Score card renderers (compact view)
   ══════════════════════════════════════════════ */
function teamRow(team, record, score, won) {
  const logo = espnLogo(team);
  return `<div class="flex items-center gap-2.5 min-w-0">
    ${logo ? `<div class="w-7 h-7 rounded-lg bg-surface-elevated shrink-0 flex items-center justify-center overflow-hidden p-0.5"><img src="${logo}" class="w-full h-full object-contain" onerror="this.style.display='none'" /></div>` : `<div class="w-7 h-7 rounded-lg bg-surface-elevated shrink-0"></div>`}
    <span class="font-sans text-sm ${won ? 'font-semibold text-ink' : 'text-ink-secondary'} truncate">${team.shortDisplayName || team.displayName || '?'}</span>
    ${record ? `<span class="font-mono text-[10px] text-ink-muted/60 tabular-nums shrink-0">${record}</span>` : ''}
    <span class="font-mono text-lg ${won ? 'font-bold text-ink' : 'font-semibold text-ink-secondary'} tabular-nums ml-auto shrink-0">${score}</span>
  </div>`;
}

function renderEspnCard(event, index) {
  const comp = event.competitions?.[0] || {};
  const comps = comp.competitors || [];
  const away = comps.find(c => c.homeAway === 'away') || comps[0] || {};
  const home = comps.find(c => c.homeAway === 'home') || comps[1] || {};
  const st = (comp.status || event.status || {}).type || {};
  const league = event._league;
  const isLive = st.state === 'in', isFinal = st.state === 'post';
  const statusText = st.shortDetail || st.detail || st.description || '';
  const awayRec = (away.records?.find(r => r.type === 'total') || away.records?.find(r => r.type === 'ytd') || away.records?.[0])?.summary || '';
  const homeRec = (home.records?.find(r => r.type === 'total') || home.records?.find(r => r.type === 'ytd') || home.records?.[0])?.summary || '';
  const awayWon = isFinal && Number(away.score) > Number(home.score);
  const homeWon = isFinal && Number(home.score) > Number(away.score);
  const broadcasts = (comp.broadcasts || []).flatMap(b => b.names || []).join(', ');
  const venue = comp.venue?.fullName || '';
  const odds = comp.odds?.[0];
  const awayLines = away.linescores || [], homeLines = home.linescores || [];
  const hasLines = awayLines.length > 0 && (isFinal || isLive);
  const periodLabels = awayLines.map((_, i) => {
    if (league === 'nhl') return i < 3 ? ['1st','2nd','3rd'][i] : i === 3 ? 'OT' : 'SO';
    return i < 4 ? `Q${i+1}` : i === 4 ? 'OT' : `${i-3}OT`;
  });

  let leaders = comp.leaders || [];
  if (!leaders.length) {
    const catMap = new Map();
    for (const cat of [...(away.leaders||[]), ...(home.leaders||[])]) {
      const top = cat.leaders?.[0]; if (!top) continue;
      const ex = catMap.get(cat.name); if (!ex || top.value > ex.leaders[0].value) catMap.set(cat.name, cat);
    }
    leaders = [...catMap.values()];
  }

  return `
    <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-hidden opacity-0 animate-fade-up cursor-pointer hover:border-ink-faint/30 transition-colors"
         style="animation-delay:${index*40}ms" data-game-espn="${event.id}" data-game-league="${league}">
      <div class="flex items-center justify-between px-4 py-2 border-b border-ink-faint/8 bg-surface-elevated/30">
        <div class="flex items-center gap-2">
          <span class="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-muted">${getLeagueName(league)}</span>
          ${venue ? `<span class="font-sans text-[10px] text-ink-muted/50 hidden sm:inline">${venue}</span>` : ''}
        </div>
        <div class="flex items-center gap-2">
          ${broadcasts ? `<span class="font-mono text-[10px] text-ink-muted/60 hidden sm:inline">${broadcasts}</span>` : ''}
          ${isLive ? `<span class="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-live"><span class="w-1.5 h-1.5 rounded-full bg-live animate-pulse-live"></span>${statusText}</span>`
            : `<span class="font-mono text-[10px] font-medium ${isFinal ? 'text-ink-muted' : 'text-ink-secondary'}">${statusText}</span>`}
        </div>
      </div>
      <div class="px-4 py-3 space-y-1.5">
        ${teamRow(away.team||{}, awayRec, away.score??'', awayWon)}
        ${teamRow(home.team||{}, homeRec, home.score??'', homeWon)}
      </div>
      ${hasLines ? `<div class="px-4 py-2 border-t border-ink-faint/8 bg-surface-elevated/20 overflow-x-auto">
        <table class="w-full text-center font-mono text-[11px] tabular-nums"><thead><tr class="text-ink-muted/60">
          <th class="text-left font-normal w-16 py-0.5"></th>
          ${periodLabels.map(l=>`<th class="font-normal px-2 py-0.5 min-w-[28px]">${l}</th>`).join('')}
          <th class="font-semibold px-2 py-0.5 text-ink-muted min-w-[32px]">T</th>
        </tr></thead><tbody>
          <tr class="${awayWon?'text-ink font-semibold':'text-ink-secondary'}"><td class="text-left py-0.5">${away.team?.abbreviation||''}</td>${awayLines.map(ls=>`<td class="px-2 py-0.5">${ls.displayValue??ls.value??'-'}</td>`).join('')}<td class="px-2 py-0.5 font-semibold text-ink">${away.score}</td></tr>
          <tr class="${homeWon?'text-ink font-semibold':'text-ink-secondary'}"><td class="text-left py-0.5">${home.team?.abbreviation||''}</td>${homeLines.map(ls=>`<td class="px-2 py-0.5">${ls.displayValue??ls.value??'-'}</td>`).join('')}<td class="px-2 py-0.5 font-semibold text-ink">${home.score}</td></tr>
        </tbody></table></div>` : ''}
      ${leaders.length > 0 && (isFinal||isLive) ? `<div class="px-4 py-2 border-t border-ink-faint/8 flex flex-wrap gap-x-5 gap-y-1.5">
        ${leaders.slice(0,3).map(cat=>{const top=cat.leaders?.[0];if(!top)return '';const a=top.athlete||{};return `<div class="flex items-center gap-2 min-w-0">
          ${a.headshot?.href?`<img src="${optHs(a.headshot.href)}" class="w-5 h-5 rounded-full object-cover bg-surface-elevated shrink-0" onerror="this.style.display='none'"/>`:''}
          <span class="font-mono text-[10px] text-ink-muted">${cat.shortDisplayName||cat.abbreviation||''}: <span class="text-ink font-medium">${a.shortName||'?'} ${top.displayValue||''}</span></span>
        </div>`;}).join('')}
      </div>` : ''}
      ${odds ? `<div class="px-4 py-1.5 border-t border-ink-faint/8 flex items-center gap-3 font-mono text-[10px] text-ink-muted/50">
        ${odds.details?`<span>${odds.details}</span>`:''}${odds.overUnder?`<span>O/U ${odds.overUnder}</span>`:''}
        ${odds.provider?.name?`<span class="ml-auto">${odds.provider.name}</span>`:''}
      </div>` : ''}
      <div class="px-4 py-1.5 border-t border-ink-faint/5 text-center">
        <span class="font-mono text-[9px] text-ink-muted/40 uppercase tracking-widest">Tap for details</span>
      </div>
    </div>
  `;
}

function renderMlbCard(game, index) {
  const st = game.status || {};
  const isLive = st.abstractGameState === 'Live', isFinal = st.abstractGameState === 'Final', isPre = st.abstractGameState === 'Preview';
  const away = game.teams?.away||{}, home = game.teams?.home||{};
  const awayT = away.team||{}, homeT = home.team||{};
  const ls = game.linescore||{};
  const innings = ls.innings||[];
  const aR = ls.teams?.away?.runs??'', hR = ls.teams?.home?.runs??'';
  const aH = ls.teams?.away?.hits??'', hH = ls.teams?.home?.hits??'';
  const aE = ls.teams?.away?.errors??'', hE = ls.teams?.home?.errors??'';
  const awayWon = isFinal && Number(aR)>Number(hR), homeWon = isFinal && Number(hR)>Number(aR);
  const awayRec = away.leagueRecord?.wins!=null?`${away.leagueRecord.wins}-${away.leagueRecord.losses}`:'';
  const homeRec = home.leagueRecord?.wins!=null?`${home.leagueRecord.wins}-${home.leagueRecord.losses}`:'';
  let statusText = st.detailedState||'';
  if (isLive) statusText = `${ls.isTopInning?'Top':'Bot'} ${ls.currentInningOrdinal||''}`;
  else if (isPre) statusText = new Date(game.gameDate).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  const venue = game.venue?.name||'';
  const broadcasts = (game.broadcasts||[]).map(b=>b.name).filter(Boolean).join(', ');
  const mlbLogo = id => id ? `https://www.mlbstatic.com/team-logos/${id}.svg` : '';
  const ap = away.probablePitcher, hp = home.probablePitcher;
  const apS = ap?.stats?.find(s=>s.type?.displayName==='statsSingleSeason'&&s.group?.displayName==='pitching')?.stats;
  const hpS = hp?.stats?.find(s=>s.type?.displayName==='statsSingleSeason'&&s.group?.displayName==='pitching')?.stats;
  const balls=ls.balls??null, hasCount=isLive&&balls!=null;

  function mlbRow(t, rec, runs, won, logo) {
    return `<div class="flex items-center gap-2.5 min-w-0">
      ${logo?`<div class="w-7 h-7 rounded-lg bg-surface-elevated shrink-0 flex items-center justify-center overflow-hidden p-0.5"><img src="${logo}" class="w-full h-full object-contain" onerror="this.style.display='none'"/></div>`:`<div class="w-7 h-7 rounded-lg bg-surface-elevated shrink-0"></div>`}
      <span class="font-sans text-sm ${won?'font-semibold text-ink':'text-ink-secondary'} truncate">${t.shortName||t.teamName||t.name||'?'}</span>
      ${rec?`<span class="font-mono text-[10px] text-ink-muted/60 tabular-nums shrink-0">${rec}</span>`:''}
      <span class="font-mono text-lg ${won?'font-bold text-ink':'font-semibold text-ink-secondary'} tabular-nums ml-auto shrink-0">${runs}</span>
    </div>`;
  }
  function bso(f,t){return Array.from({length:t},(_,i)=>`<span class="w-2 h-2 rounded-full ${i<f?'bg-accent':'bg-ink-faint/30'}"></span>`).join('');}
  function pRow(p,s,lbl){if(!p)return '';const era=s?.era?`${s.era} ERA`:'';const rec=s?.wins!=null?`${s.wins}-${s.losses}`:'';return `<div class="flex items-center gap-2 min-w-0"><span class="font-mono text-[10px] text-ink-muted/50 w-8 shrink-0">${lbl||''}</span><span class="font-sans text-[11px] font-medium text-ink truncate">${p.fullName||'?'}</span>${[rec,era].filter(Boolean).join(', ')?`<span class="font-mono text-[10px] text-ink-muted tabular-nums shrink-0">${[rec,era].filter(Boolean).join(', ')}</span>`:''}</div>`;}

  return `
    <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-hidden opacity-0 animate-fade-up cursor-pointer hover:border-ink-faint/30 transition-colors"
         style="animation-delay:${index*40}ms" data-game-mlb="${game.gamePk}" data-game-league="mlb">
      <div class="flex items-center justify-between px-4 py-2 border-b border-ink-faint/8 bg-surface-elevated/30">
        <div class="flex items-center gap-2"><span class="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-muted">MLB</span>${venue?`<span class="font-sans text-[10px] text-ink-muted/50 hidden sm:inline">${venue}</span>`:''}</div>
        <div class="flex items-center gap-2">${broadcasts?`<span class="font-mono text-[10px] text-ink-muted/60 hidden sm:inline">${broadcasts}</span>`:''}
          ${isLive?`<span class="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-live"><span class="w-1.5 h-1.5 rounded-full bg-live animate-pulse-live"></span>${statusText}</span>`:`<span class="font-mono text-[10px] font-medium ${isFinal?'text-ink-muted':'text-ink-secondary'}">${statusText}</span>`}</div>
      </div>
      <div class="px-4 py-3 space-y-1.5">${mlbRow(awayT,awayRec,aR,awayWon,mlbLogo(awayT.id))}${mlbRow(homeT,homeRec,hR,homeWon,mlbLogo(homeT.id))}</div>
      ${hasCount?`<div class="px-4 pb-2 flex items-center gap-1.5 font-mono text-[10px] text-ink-muted"><span>B</span>${bso(ls.balls,4)}<span class="ml-1.5">S</span>${bso(ls.strikes,3)}<span class="ml-1.5">O</span>${bso(ls.outs,3)}</div>`:''}
      ${innings.length>0?`<div class="px-4 py-2 border-t border-ink-faint/8 bg-surface-elevated/20 overflow-x-auto"><table class="w-full text-center font-mono text-[11px] tabular-nums"><thead><tr class="text-ink-muted/60"><th class="text-left font-normal w-16 py-0.5"></th>${innings.map(i=>`<th class="font-normal px-1.5 py-0.5 min-w-[22px]">${i.num}</th>`).join('')}<th class="font-semibold px-2 py-0.5 text-ink-muted border-l border-ink-faint/10 min-w-[28px]">R</th><th class="font-semibold px-2 py-0.5 text-ink-muted min-w-[28px]">H</th><th class="font-semibold px-2 py-0.5 text-ink-muted min-w-[28px]">E</th></tr></thead><tbody>
        <tr class="${awayWon?'text-ink font-semibold':'text-ink-secondary'}"><td class="text-left py-0.5">${awayT.abbreviation||''}</td>${innings.map(i=>`<td class="px-1.5 py-0.5">${i.away?.runs??'-'}</td>`).join('')}<td class="px-2 py-0.5 font-semibold text-ink border-l border-ink-faint/10">${aR}</td><td class="px-2 py-0.5">${aH}</td><td class="px-2 py-0.5">${aE}</td></tr>
        <tr class="${homeWon?'text-ink font-semibold':'text-ink-secondary'}"><td class="text-left py-0.5">${homeT.abbreviation||''}</td>${innings.map(i=>`<td class="px-1.5 py-0.5">${i.home?.runs??'-'}</td>`).join('')}<td class="px-2 py-0.5 font-semibold text-ink border-l border-ink-faint/10">${hR}</td><td class="px-2 py-0.5">${hH}</td><td class="px-2 py-0.5">${hE}</td></tr>
      </tbody></table></div>`:''}
      ${(ap||hp)?`<div class="px-4 py-2 border-t border-ink-faint/8 space-y-1">${pRow(ap,apS,isPre?'SP':awayT.abbreviation)}${pRow(hp,hpS,isPre?'SP':homeT.abbreviation)}</div>`:''}
      <div class="px-4 py-1.5 border-t border-ink-faint/5 text-center"><span class="font-mono text-[9px] text-ink-muted/40 uppercase tracking-widest">Tap for details</span></div>
    </div>
  `;
}

/* ══════════════════════════════════════════════
   Expanded detail renderers
   ══════════════════════════════════════════════ */
function detailTabs(tabs, activeId) {
  return `<div class="flex gap-1 pill-scroll -mx-1 px-1 pb-3 border-b border-ink-faint/8 mb-4">
    ${tabs.map(t => `<button class="filter-pill whitespace-nowrap shrink-0 ${t.id===activeId?'active':''}" data-detail-tab="${t.id}">${t.label}</button>`).join('')}
  </div>`;
}

function renderEspnDetail(summary, league) {
  const box = summary.boxscore || {};
  const plays = summary.plays || [];
  const gameInfo = summary.gameInfo || {};
  const header = summary.header || {};
  const scoringPlays = plays.filter(p => p.scoringPlay);
  const comp = header.competitions?.[0] || {};

  // Box score
  const boxHtml = (box.players || []).map(teamData => {
    const team = teamData.team || {};
    const stats = teamData.statistics || [];
    if (!stats.length) return '';
    const cat = stats[0];
    const labels = cat.labels || [];
    const athletes = cat.athletes || [];
    if (!athletes.length) return '';
    return `
      <div class="mb-4">
        <div class="flex items-center gap-2 mb-2">
          ${team.logo?`<img src="${team.logo}" class="w-5 h-5 object-contain"/>`:''}
          <span class="font-mono text-[11px] font-semibold text-ink uppercase tracking-wider">${team.shortDisplayName || team.displayName || ''}</span>
        </div>
        <div class="rounded-xl border border-ink-faint/10 overflow-x-auto">
          <table class="w-full text-[11px] font-mono tabular-nums">
            <thead><tr class="bg-surface-elevated/40 border-b border-ink-faint/10 text-[9px] text-ink-muted uppercase tracking-widest">
              <th class="text-left px-2 py-1.5 sticky left-0 bg-surface-elevated/40 min-w-[120px]">Player</th>
              ${labels.map(l => `<th class="text-center px-1.5 py-1.5 whitespace-nowrap">${l}</th>`).join('')}
            </tr></thead>
            <tbody>${athletes.map(a => {
              const ath = a.athlete || {};
              const starter = a.starter;
              const didNotPlay = a.didNotPlay;
              if (didNotPlay) return '';
              return `<tr class="border-b border-ink-faint/5 last:border-0 ${starter?'':'text-ink-muted'}">
                <td class="px-2 py-1.5 sticky left-0 bg-surface-card whitespace-nowrap">
                  <span class="font-sans text-[11px] ${starter?'font-medium text-ink':'text-ink-secondary'}">${ath.shortName || ath.displayName || '?'}</span>
                  <span class="text-[9px] text-ink-muted ml-1">${ath.position?.abbreviation || ''}</span>
                </td>
                ${(a.stats || []).map(v => `<td class="text-center px-1.5 py-1.5">${v}</td>`).join('')}
              </tr>`;
            }).join('')}
            ${cat.totals ? `<tr class="border-t-2 border-ink-faint/15 font-semibold bg-surface-elevated/20" data-sort-pin>
              <td class="px-2 py-1.5 sticky left-0 bg-surface-elevated/20 text-ink text-[10px]">TOTALS</td>
              ${cat.totals.map(v => `<td class="text-center px-1.5 py-1.5">${v}</td>`).join('')}
            </tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  // Scoring plays
  const scoringHtml = scoringPlays.length > 0 ? scoringPlays.map(p => {
    const period = p.period?.displayValue || '';
    const clock = p.clock?.displayValue || '';
    return `<div class="flex gap-3 py-2 border-b border-ink-faint/5 last:border-0">
      <div class="font-mono text-[10px] text-ink-muted w-16 shrink-0 tabular-nums">${period} ${clock}</div>
      <div class="flex-1 min-w-0">
        <p class="font-sans text-[12px] text-ink leading-relaxed">${p.text || ''}</p>
        <p class="font-mono text-[10px] text-ink-muted mt-0.5">${p.awayScore || 0} - ${p.homeScore || 0}</p>
      </div>
    </div>`;
  }).join('') : '<p class="text-ink-muted text-center py-4 font-mono text-[11px]">No scoring plays</p>';

  // Plays (last 30)
  const recentPlays = plays.slice(-30).reverse();
  const playsHtml = recentPlays.length > 0 ? recentPlays.map(p => {
    const period = p.period?.displayValue || '';
    const clock = p.clock?.displayValue || '';
    const isScore = p.scoringPlay;
    return `<div class="flex gap-3 py-1.5 border-b border-ink-faint/5 last:border-0 ${isScore ? 'bg-accent-soft/30 -mx-2 px-2 rounded' : ''}">
      <div class="font-mono text-[9px] text-ink-muted w-16 shrink-0 tabular-nums">${period} ${clock}</div>
      <p class="font-sans text-[11px] text-ink-secondary leading-relaxed flex-1">${p.text || ''}</p>
      ${isScore ? `<span class="font-mono text-[10px] text-accent font-semibold shrink-0">${p.awayScore}-${p.homeScore}</span>` : ''}
    </div>`;
  }).join('') : '<p class="text-ink-muted text-center py-4 font-mono text-[11px]">No plays available</p>';

  // Game info
  const officials = (comp.officials || summary.gameInfo?.officials || []).map(o => (o.displayName || o.fullName || '')).filter(Boolean);
  const attendance = gameInfo.attendance || comp.attendance;
  const venue = gameInfo.venue || comp.venue || {};
  const infoHtml = `<div class="space-y-2">
    ${venue.fullName ? `<div><span class="font-mono text-[9px] text-ink-muted uppercase tracking-widest">Venue</span><p class="font-sans text-sm text-ink">${venue.fullName}${venue.address?.city ? ', ' + venue.address.city : ''}</p></div>` : ''}
    ${attendance ? `<div><span class="font-mono text-[9px] text-ink-muted uppercase tracking-widest">Attendance</span><p class="font-sans text-sm text-ink">${Number(attendance).toLocaleString()}</p></div>` : ''}
    ${officials.length ? `<div><span class="font-mono text-[9px] text-ink-muted uppercase tracking-widest">Officials</span><p class="font-sans text-sm text-ink-secondary">${officials.join(', ')}</p></div>` : ''}
  </div>`;

  return { boxHtml, scoringHtml, playsHtml, infoHtml };
}

function renderMlbDetail(feed) {
  const ld = feed.liveData || {};
  const box = ld.boxscore || {};
  const allPlays = ld.plays?.allPlays || [];
  const scoringIndices = ld.plays?.scoringPlays || [];
  const decisions = ld.decisions || {};
  const gd = feed.gameData || {};

  function mlbBoxTeam(side, teamData) {
    const batters = teamData.batters || [];
    const pitchers = teamData.pitchers || [];
    const players = teamData.players || {};
    const team = teamData.team || {};
    const teamLogo = team.id ? `https://www.mlbstatic.com/team-logos/${team.id}.svg` : '';

    const batterRows = batters.map(id => {
      const p = players['ID' + id];
      if (!p) return '';
      const s = p.stats?.batting || {};
      const person = p.person || {};
      const pos = p.position?.abbreviation || p.allPositions?.map(x=>x.abbreviation).join('-') || '';
      return `<tr class="border-b border-ink-faint/5 last:border-0">
        <td class="px-2 py-1 sticky left-0 bg-surface-card whitespace-nowrap"><span class="font-sans text-[11px] font-medium text-ink">${person.fullName||'?'}</span> <span class="text-[9px] text-ink-muted">${pos}</span></td>
        <td class="text-center px-1.5 py-1">${s.atBats??'-'}</td><td class="text-center px-1.5 py-1">${s.runs??'-'}</td>
        <td class="text-center px-1.5 py-1">${s.hits??'-'}</td><td class="text-center px-1.5 py-1">${s.rbi??'-'}</td>
        <td class="text-center px-1.5 py-1">${s.baseOnBalls??'-'}</td><td class="text-center px-1.5 py-1">${s.strikeOuts??'-'}</td>
        <td class="text-center px-1.5 py-1 font-semibold">${s.avg??'-'}</td>
      </tr>`;
    }).join('');

    const pitcherRows = pitchers.map(id => {
      const p = players['ID' + id];
      if (!p) return '';
      const s = p.stats?.pitching || {};
      const person = p.person || {};
      return `<tr class="border-b border-ink-faint/5 last:border-0">
        <td class="px-2 py-1 sticky left-0 bg-surface-card whitespace-nowrap"><span class="font-sans text-[11px] font-medium text-ink">${person.fullName||'?'}</span></td>
        <td class="text-center px-1.5 py-1">${s.inningsPitched??'-'}</td><td class="text-center px-1.5 py-1">${s.hits??'-'}</td>
        <td class="text-center px-1.5 py-1">${s.runs??'-'}</td><td class="text-center px-1.5 py-1">${s.earnedRuns??'-'}</td>
        <td class="text-center px-1.5 py-1">${s.baseOnBalls??'-'}</td><td class="text-center px-1.5 py-1">${s.strikeOuts??'-'}</td>
        <td class="text-center px-1.5 py-1 font-semibold">${s.era??'-'}</td>
      </tr>`;
    }).join('');

    return `<div class="mb-4">
      <div class="flex items-center gap-2 mb-2">${teamLogo?`<img src="${teamLogo}" class="w-5 h-5 object-contain"/>`:''}<span class="font-mono text-[11px] font-semibold text-ink uppercase tracking-wider">${team.name||side}</span></div>
      <div class="rounded-xl border border-ink-faint/10 overflow-x-auto mb-3">
        <table class="w-full text-[11px] font-mono tabular-nums"><thead><tr class="bg-surface-elevated/40 border-b border-ink-faint/10 text-[9px] text-ink-muted uppercase tracking-widest">
          <th class="text-left px-2 py-1.5 sticky left-0 bg-surface-elevated/40 min-w-[120px]">Batter</th>
          <th class="text-center px-1.5 py-1.5">AB</th><th class="text-center px-1.5 py-1.5">R</th><th class="text-center px-1.5 py-1.5">H</th><th class="text-center px-1.5 py-1.5">RBI</th><th class="text-center px-1.5 py-1.5">BB</th><th class="text-center px-1.5 py-1.5">SO</th><th class="text-center px-1.5 py-1.5">AVG</th>
        </tr></thead><tbody>${batterRows}</tbody></table>
      </div>
      <div class="rounded-xl border border-ink-faint/10 overflow-x-auto">
        <table class="w-full text-[11px] font-mono tabular-nums"><thead><tr class="bg-surface-elevated/40 border-b border-ink-faint/10 text-[9px] text-ink-muted uppercase tracking-widest">
          <th class="text-left px-2 py-1.5 sticky left-0 bg-surface-elevated/40 min-w-[120px]">Pitcher</th>
          <th class="text-center px-1.5 py-1.5">IP</th><th class="text-center px-1.5 py-1.5">H</th><th class="text-center px-1.5 py-1.5">R</th><th class="text-center px-1.5 py-1.5">ER</th><th class="text-center px-1.5 py-1.5">BB</th><th class="text-center px-1.5 py-1.5">SO</th><th class="text-center px-1.5 py-1.5">ERA</th>
        </tr></thead><tbody>${pitcherRows}</tbody></table>
      </div>
    </div>`;
  }

  const boxHtml = `${mlbBoxTeam('Away', box.teams?.away||{})}${mlbBoxTeam('Home', box.teams?.home||{})}`;

  // Scoring plays
  const scoringPlays = scoringIndices.map(i => allPlays[i]).filter(Boolean);
  const scoringHtml = scoringPlays.length > 0 ? scoringPlays.map(p => {
    const r = p.result || {};
    const about = p.about || {};
    return `<div class="flex gap-3 py-2 border-b border-ink-faint/5 last:border-0">
      <div class="font-mono text-[10px] text-ink-muted w-16 shrink-0">${about.halfInning ? (about.isTopInning?'Top':'Bot')+' '+about.inning : ''}</div>
      <div class="flex-1"><p class="font-sans text-[12px] text-ink">${r.description || ''}</p>
        <p class="font-mono text-[10px] text-ink-muted mt-0.5">${r.awayScore??0} - ${r.homeScore??0}</p></div>
    </div>`;
  }).join('') : '<p class="text-ink-muted text-center py-4 font-mono text-[11px]">No scoring plays</p>';

  // Recent plays
  const recent = allPlays.slice(-25).reverse();
  const playsHtml = recent.length > 0 ? recent.map(p => {
    const r = p.result || {};
    const about = p.about || {};
    const isScore = about.isScoringPlay;
    return `<div class="flex gap-3 py-1.5 border-b border-ink-faint/5 last:border-0 ${isScore?'bg-accent-soft/30 -mx-2 px-2 rounded':''}">
      <div class="font-mono text-[9px] text-ink-muted w-16 shrink-0">${about.halfInning?(about.isTopInning?'T':'B')+about.inning:''}</div>
      <p class="font-sans text-[11px] text-ink-secondary leading-relaxed flex-1">${r.description || ''}</p>
    </div>`;
  }).join('') : '';

  // Game info
  const weather = gd.weather || {};
  const venueData = gd.venue || {};
  const officials = (box.officials || []).map(o => `${o.official?.fullName||''} (${o.officialType||''})`).filter(Boolean);
  const wp = decisions.winner?.fullName, lp = decisions.loser?.fullName, sv = decisions.save?.fullName;
  const infoHtml = `<div class="space-y-2">
    ${venueData.name ? `<div><span class="font-mono text-[9px] text-ink-muted uppercase tracking-widest">Venue</span><p class="font-sans text-sm text-ink">${venueData.name}${venueData.location?.city ? ', ' + venueData.location.city : ''}</p></div>` : ''}
    ${weather.temp ? `<div><span class="font-mono text-[9px] text-ink-muted uppercase tracking-widest">Weather</span><p class="font-sans text-sm text-ink">${weather.temp}F, ${weather.condition||''}, Wind ${weather.wind||''}</p></div>` : ''}
    ${wp ? `<div><span class="font-mono text-[9px] text-ink-muted uppercase tracking-widest">Decision</span><p class="font-sans text-sm text-ink">W: ${wp} / L: ${lp||''}${sv ? ' / SV: '+sv : ''}</p></div>` : ''}
    ${officials.length ? `<div><span class="font-mono text-[9px] text-ink-muted uppercase tracking-widest">Umpires</span><p class="font-sans text-sm text-ink-secondary">${officials.join(', ')}</p></div>` : ''}
  </div>`;

  return { boxHtml, scoringHtml, playsHtml, infoHtml };
}

/* ══════════════════════════════════════════════
   Page
   ══════════════════════════════════════════════ */
export function ScoresPage(container) {
  const cleanups = [];
  let selectedDate = new Date();
  let selectedLeague = 'all';
  let loading = false;
  let expandedId = null;
  const detailCache = new Map();

  function dateStrip() {
    const dates = [];
    for (let i = -3; i <= 3; i++) dates.push(shiftDay(selectedDate, i));
    return dates.map(d => {
      const isSel = d.toDateString() === selectedDate.toDateString();
      const isToday = d.toDateString() === new Date().toDateString();
      return `<button class="shrink-0 px-3 py-1.5 rounded-lg font-mono text-[11px] tabular-nums transition-all duration-200
                ${isSel ? 'bg-ink text-surface-card font-semibold shadow-bezel' : isToday ? 'text-accent font-medium hover:bg-surface-elevated' : 'text-ink-muted hover:text-ink hover:bg-surface-elevated'}"
              data-score-date="${espnDate(d)}">${isToday && !isSel ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</button>`;
    }).join('');
  }

  function renderShell() {
    expandedId = null;
    container.innerHTML = `
      <div class="pt-6 opacity-0 animate-fade-up">
        <div class="mb-6">
          <h1 class="font-mono text-2xl sm:text-3xl font-bold tracking-tighter text-ink mb-1">Scores</h1>
          <p class="font-sans text-sm text-ink-secondary">${dayLabel(selectedDate)}</p>
        </div>
        <div class="flex items-center gap-1 mb-4 pb-2 -mx-1 px-1 pill-scroll">
          <button class="shrink-0 w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center text-ink-muted hover:text-ink transition-colors" data-date-shift="-7"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg></button>
          ${dateStrip()}
          <button class="shrink-0 w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center text-ink-muted hover:text-ink transition-colors" data-date-shift="7"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></button>
        </div>
        <div class="flex items-center gap-1 mb-6 pb-5 border-b border-ink-faint/8 pill-scroll">
          <button class="filter-pill ${selectedLeague==='all'?'active':''}" data-score-league="all">All</button>
          ${SUPPORTED_LEAGUES.map(lg => `<button class="filter-pill ${lg===selectedLeague?'active':''}" data-score-league="${lg}">${getLeagueName(lg)}</button>`).join('')}
        </div>
        <div id="scores-content">${spinner()}</div>
      </div>`;
  }

  async function loadScores() {
    const content = container.querySelector('#scores-content');
    if (!content) return;
    loading = true; content.innerHTML = spinner();
    try {
      const leagues = selectedLeague === 'all' ? SUPPORTED_LEAGUES : [selectedLeague];
      const results = await Promise.all(leagues.map(lg => lg === 'mlb' ? fetchMlb(selectedDate) : fetchEspn(lg, selectedDate)));
      const sections = [];
      leagues.forEach((lg, i) => { if (results[i]?.length) sections.push({ league: lg, games: results[i] }); });
      if (!sections.length) {
        content.innerHTML = `<div class="flex flex-col items-center justify-center py-20 text-center">
          <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mb-2">No games</p>
          <p class="font-sans text-ink-secondary text-sm">No games scheduled for ${dayLabel(selectedDate).toLowerCase()}.</p></div>`;
        return;
      }
      let idx = 0;
      content.innerHTML = sections.map(s => {
        const hdr = selectedLeague === 'all' ? `<div class="flex items-center gap-2 mb-4 mt-6 first:mt-0"><h2 class="font-mono text-xs font-semibold uppercase tracking-widest text-ink-muted">${getLeagueName(s.league)}</h2><span class="font-mono text-[10px] text-ink-muted/40">${s.games.length}</span><div class="flex-1 h-px bg-ink-faint/10"></div></div>` : '';
        const cards = s.games.map(g => { const i = idx++; return s.league === 'mlb' && g.gamePk ? renderMlbCard(g, i) : renderEspnCard(g, i); }).join('');
        return `${hdr}<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">${cards}</div>`;
      }).join('');
    } catch (err) {
      console.error(err); content.innerHTML = `<p class="text-ink-muted text-center py-8 font-mono text-sm">Failed to load scores</p>`;
    } finally { loading = false; }
  }

  async function expandGame(el) {
    const espnId = el.dataset.gameEspn;
    const mlbId = el.dataset.gameMlb;
    const league = el.dataset.gameLeague;
    const gameId = espnId || mlbId;
    if (!gameId) return;

    // Toggle off
    if (expandedId === gameId) {
      document.getElementById('game-detail-panel')?.remove();
      expandedId = null;
      el.classList.remove('ring-2', 'ring-accent/30');
      return;
    }

    // Remove previous
    document.getElementById('game-detail-panel')?.remove();
    container.querySelectorAll('[data-game-espn],[data-game-mlb]').forEach(c => c.classList.remove('ring-2', 'ring-accent/30'));

    expandedId = gameId;
    el.classList.add('ring-2', 'ring-accent/30');

    // Insert detail panel after the card
    const panel = document.createElement('div');
    panel.id = 'game-detail-panel';
    panel.className = 'col-span-full rounded-2xl bg-surface-card border border-ink-faint/15 overflow-hidden mt-1 mb-2';
    panel.innerHTML = miniSpinner();
    el.insertAdjacentElement('afterend', panel);

    try {
      let detail;
      if (detailCache.has(gameId)) {
        detail = detailCache.get(gameId);
      } else if (mlbId) {
        const feed = await fetchMlbFeed(mlbId);
        detail = feed ? renderMlbDetail(feed) : null;
      } else {
        const summary = await fetchEspnSummary(league, espnId);
        detail = summary ? renderEspnDetail(summary, league) : null;
      }

      if (!detail) { panel.innerHTML = '<p class="text-ink-muted text-center py-6 font-mono text-sm">Details unavailable</p>'; return; }
      detailCache.set(gameId, detail);

      const tabs = [
        { id: 'box', label: 'Box Score' },
        { id: 'scoring', label: 'Scoring' },
        { id: 'plays', label: 'Plays' },
        { id: 'info', label: 'Game Info' },
      ];

      panel.innerHTML = `<div class="p-4">
        ${detailTabs(tabs, 'box')}
        <div data-tab-content="box">${detail.boxHtml || '<p class="text-ink-muted text-center py-4 text-sm">No box score</p>'}</div>
        <div data-tab-content="scoring" class="hidden">${detail.scoringHtml}</div>
        <div data-tab-content="plays" class="hidden max-h-96 overflow-y-auto">${detail.playsHtml}</div>
        <div data-tab-content="info" class="hidden">${detail.infoHtml}</div>
      </div>`;
      enableTableSort(panel);
    } catch (err) {
      console.error(err);
      panel.innerHTML = '<p class="text-ink-muted text-center py-6 font-mono text-sm">Failed to load details</p>';
    }
  }

  renderShell();
  loadScores();

  // Card expand
  cleanups.push(delegate(container, 'click', '[data-game-espn],[data-game-mlb]', (e, target) => {
    const card = target.closest('[data-game-espn],[data-game-mlb]');
    if (card) expandGame(card);
  }));

  // Detail tabs
  cleanups.push(delegate(container, 'click', '[data-detail-tab]', (e, target) => {
    const panel = document.getElementById('game-detail-panel');
    if (!panel) return;
    const tabId = target.dataset.detailTab;
    panel.querySelectorAll('[data-detail-tab]').forEach(b => b.classList.toggle('active', b.dataset.detailTab === tabId));
    panel.querySelectorAll('[data-tab-content]').forEach(el => el.classList.toggle('hidden', el.dataset.tabContent !== tabId));
  }));

  cleanups.push(delegate(container, 'click', '[data-score-date]', (e, t) => {
    const ds = t.dataset.scoreDate; selectedDate = new Date(parseInt(ds.slice(0,4)), parseInt(ds.slice(4,6))-1, parseInt(ds.slice(6,8)));
    detailCache.clear(); renderShell(); loadScores();
  }));
  cleanups.push(delegate(container, 'click', '[data-date-shift]', (e, t) => {
    selectedDate = shiftDay(selectedDate, parseInt(t.dataset.dateShift));
    detailCache.clear(); renderShell(); loadScores();
  }));
  cleanups.push(delegate(container, 'click', '[data-score-league]', (e, t) => {
    selectedLeague = t.dataset.scoreLeague;
    container.querySelectorAll('[data-score-league]').forEach(b => b.classList.toggle('active', b.dataset.scoreLeague === selectedLeague));
    loadScores();
  }));

  const interval = setInterval(() => { if (!loading) loadScores(); }, 30_000);
  cleanups.push(() => clearInterval(interval));

  return () => cleanups.forEach(fn => fn());
}
