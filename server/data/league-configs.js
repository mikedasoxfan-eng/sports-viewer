/**
 * League keyword configs for matching streamed.pk matches to leagues.
 * Ported from lib/api-helpers.js LEAGUE_CONFIGS.
 */

export const LEAGUE_CONFIGS = {
  nfl: {
    categories: ['american-football', 'nfl', 'football-am'],
    brand_keywords: ['nfl', 'redzone', 'red zone', 'nfl network'],
    team_keywords: [
      'bills', 'dolphins', 'patriots', 'jets',
      'ravens', 'bengals', 'browns', 'steelers',
      'texans', 'colts', 'jaguars', 'titans',
      'broncos', 'chiefs', 'raiders', 'chargers',
      'cowboys', 'giants', 'eagles', 'commanders',
      'bears', 'lions', 'packers', 'vikings',
      'falcons', 'panthers', 'saints', 'buccaneers',
      'cardinals', 'rams', '49ers', 'seahawks'
    ],
    exclude_keywords: [
      'ncaaf', 'ncaa', 'college', 'cfb', 'fbs', 'fcs',
      'xfl', 'usfl', 'cfl', 'arena', 'nhl', 'hockey', 'ice hockey'
    ]
  },
  nba: {
    categories: ['basketball', 'nba'],
    brand_keywords: ['nba', 'nba tv', 'league pass', 'summer league', 'all-star', 'all star'],
    team_keywords: [
      'hawks', 'celtics', 'nets', 'hornets',
      'bulls', 'cavaliers', 'mavericks', 'nuggets',
      'pistons', 'warriors', 'rockets', 'pacers',
      'clippers', 'lakers', 'grizzlies', 'heat',
      'bucks', 'timberwolves', 'pelicans', 'knicks',
      'thunder', 'magic', '76ers', 'sixers',
      'suns', 'trail blazers', 'blazers', 'kings',
      'spurs', 'raptors', 'jazz', 'wizards'
    ],
    exclude_keywords: [
      'wnba', 'ncaab', 'ncaa', 'college', 'g league', 'gleague',
      'fiba', 'euroleague', 'nhl', 'hockey', 'ice hockey'
    ]
  },
  mlb: {
    categories: ['baseball', 'mlb'],
    brand_keywords: ['mlb', 'mlb network', 'world series', 'spring training', 'all-star'],
    team_keywords: [
      'orioles', 'red sox', 'yankees', 'rays', 'blue jays',
      'white sox', 'guardians', 'tigers', 'royals', 'twins',
      'astros', 'angels', 'athletics', 'mariners', 'rangers',
      'braves', 'marlins', 'mets', 'phillies', 'nationals',
      'cubs', 'reds', 'brewers', 'pirates', 'cardinals',
      'diamondbacks', 'rockies', 'dodgers', 'padres', 'giants'
    ],
    exclude_keywords: [
      'college', 'ncaa', 'minor league', 'triple-a', 'double-a', 'kbo', 'npb'
    ]
  },
  nhl: {
    categories: ['hockey', 'ice-hockey', 'nhl'],
    brand_keywords: ['nhl', 'nhl network', 'hockey night', 'stanley cup', 'winter classic'],
    team_keywords: [
      'ducks', 'bruins', 'sabres', 'flames',
      'hurricanes', 'blackhawks', 'avalanche', 'blue jackets',
      'stars', 'red wings', 'oilers', 'panthers',
      'kings', 'wild', 'canadiens', 'predators',
      'devils', 'islanders', 'rangers', 'senators',
      'flyers', 'penguins', 'sharks', 'kraken',
      'blues', 'lightning', 'maple leafs', 'leafs',
      'canucks', 'golden knights', 'capitals', 'jets',
      'utah', 'coyotes'
    ],
    exclude_keywords: [
      'ahl', 'khl', 'ncaa', 'college', 'whl', 'ohl', 'qmjhl',
      'iihf', 'world juniors', 'olympics'
    ]
  }
};

export const PRIORITY_LEAGUES = ['nfl', 'nba', 'mlb', 'nhl'];
