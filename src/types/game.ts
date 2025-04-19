
export type GameMode = 301 | 501;

export type PlayerState = {
  id: number;
  name: string;
  score: number;
  initialScore: number;
  dartsThrown: number;
  legsWon: number;
  currentTurn: boolean;
  history: Turn[];
};

export type DartScore = {
  segment: number;
  multiplier: 1 | 2 | 3;
  isBull?: boolean;
  isOuterBull?: boolean;
  points: number;
};

export type Turn = {
  darts: DartScore[];
  score: number;
  remainingScore: number;
  bust: boolean;
};

export type GameState = {
  gameMode: GameMode;
  players: PlayerState[];
  legsToWin: number;
  currentPlayerIndex: number;
  dartsRemaining: number;
  gameStarted: boolean;
  gameFinished: boolean;
  currentTurn: DartScore[];
};

export type CheckoutSuggestion = {
  darts: string[];
  totalPoints: number;
};

export const CHECKOUT_SUGGESTIONS: Record<number, CheckoutSuggestion[]> = {
  // Three-dart checkouts
  170: [{ darts: ["T20", "T20", "Bull"], totalPoints: 170 }],
  167: [{ darts: ["T20", "T19", "Bull"], totalPoints: 167 }],
  164: [{ darts: ["T20", "T18", "Bull"], totalPoints: 164 }],
  161: [{ darts: ["T20", "T17", "Bull"], totalPoints: 161 }],
  160: [{ darts: ["T20", "T20", "D20"], totalPoints: 160 }],
  158: [{ darts: ["T20", "T20", "D19"], totalPoints: 158 }],
  157: [{ darts: ["T20", "T19", "D20"], totalPoints: 157 }],
  156: [{ darts: ["T20", "T20", "D18"], totalPoints: 156 }],
  155: [{ darts: ["T20", "T19", "D19"], totalPoints: 155 }],
  154: [{ darts: ["T20", "T18", "D20"], totalPoints: 154 }],
  153: [{ darts: ["T20", "T19", "D18"], totalPoints: 153 }],
  152: [{ darts: ["T20", "T20", "D16"], totalPoints: 152 }],
  151: [{ darts: ["T20", "T17", "D20"], totalPoints: 151 }],
  150: [{ darts: ["T20", "T18", "D18"], totalPoints: 150 }],
  149: [{ darts: ["T20", "T19", "D16"], totalPoints: 149 }],
  148: [{ darts: ["T20", "T20", "D14"], totalPoints: 148 }],
  147: [{ darts: ["T20", "T17", "D18"], totalPoints: 147 }],
  146: [{ darts: ["T20", "T18", "D16"], totalPoints: 146 }],
  145: [{ darts: ["T20", "T19", "D14"], totalPoints: 145 }],
  144: [{ darts: ["T20", "T20", "D12"], totalPoints: 144 }],
  143: [{ darts: ["T20", "T17", "D16"], totalPoints: 143 }],
  142: [{ darts: ["T20", "T14", "D20"], totalPoints: 142 }],
  141: [{ darts: ["T20", "T19", "D12"], totalPoints: 141 }],
  140: [{ darts: ["T20", "T20", "D10"], totalPoints: 140 }],
  139: [{ darts: ["T20", "T19", "D11"], totalPoints: 139 }],
  138: [{ darts: ["T20", "T18", "D12"], totalPoints: 138 }],
  137: [{ darts: ["T20", "T19", "D10"], totalPoints: 137 }],
  136: [{ darts: ["T20", "T20", "D8"], totalPoints: 136 }],
  135: [{ darts: ["T20", "T17", "D12"], totalPoints: 135 }],
  134: [{ darts: ["T20", "T14", "D16"], totalPoints: 134 }],
  133: [{ darts: ["T20", "T19", "D8"], totalPoints: 133 }],
  132: [{ darts: ["T20", "T16", "D12"], totalPoints: 132 }],
  131: [{ darts: ["T20", "T13", "D16"], totalPoints: 131 }],
  130: [{ darts: ["T20", "T18", "D8"], totalPoints: 130 }],
  129: [{ darts: ["T19", "T16", "D12"], totalPoints: 129 }],
  128: [{ darts: ["T20", "T16", "D10"], totalPoints: 128 }],
  127: [{ darts: ["T20", "T17", "D8"], totalPoints: 127 }],
  126: [{ darts: ["T19", "T19", "D6"], totalPoints: 126 }],
  125: [{ darts: ["T20", "T19", "D4"], totalPoints: 125 }],
  124: [{ darts: ["T20", "T16", "D8"], totalPoints: 124 }],
  123: [{ darts: ["T19", "T16", "D9"], totalPoints: 123 }],
  122: [{ darts: ["T18", "T18", "D7"], totalPoints: 122 }],
  121: [{ darts: ["T20", "T11", "D14"], totalPoints: 121 }],
  120: [{ darts: ["T20", "20", "D20"], totalPoints: 120 }],
  119: [{ darts: ["T19", "T12", "D13"], totalPoints: 119 }],
  118: [{ darts: ["T20", "18", "D20"], totalPoints: 118 }],
  117: [{ darts: ["T20", "17", "D20"], totalPoints: 117 }],
  116: [{ darts: ["T20", "16", "D20"], totalPoints: 116 }],
  115: [{ darts: ["T20", "15", "D20"], totalPoints: 115 }],
  114: [{ darts: ["T20", "14", "D20"], totalPoints: 114 }],
  113: [{ darts: ["T20", "13", "D20"], totalPoints: 113 }],
  112: [{ darts: ["T20", "12", "D20"], totalPoints: 112 }],
  111: [{ darts: ["T20", "11", "D20"], totalPoints: 111 }],
  110: [{ darts: ["T20", "10", "D20"], totalPoints: 110 }],
  109: [{ darts: ["T20", "9", "D20"], totalPoints: 109 }],
  108: [{ darts: ["T20", "8", "D20"], totalPoints: 108 }],
  107: [{ darts: ["T19", "10", "D20"], totalPoints: 107 }],
  106: [{ darts: ["T20", "6", "D20"], totalPoints: 106 }],
  105: [{ darts: ["T20", "5", "D20"], totalPoints: 105 }],
  104: [{ darts: ["T18", "10", "D20"], totalPoints: 104 }],
  103: [{ darts: ["T19", "6", "D20"], totalPoints: 103 }],
  102: [{ darts: ["T20", "10", "D16"], totalPoints: 102 }],
  101: [{ darts: ["T17", "10", "D20"], totalPoints: 101 }],
  100: [{ darts: ["T20", "D20"], totalPoints: 100 }],
  
  // Two-dart checkouts
  99: [{ darts: ["T19", "D21"], totalPoints: 99 }],
  98: [{ darts: ["T20", "D19"], totalPoints: 98 }],
  97: [{ darts: ["T19", "D20"], totalPoints: 97 }],
  96: [{ darts: ["T20", "D18"], totalPoints: 96 }],
  95: [{ darts: ["T19", "D19"], totalPoints: 95 }],
  94: [{ darts: ["T18", "D20"], totalPoints: 94 }],
  93: [{ darts: ["T19", "D18"], totalPoints: 93 }],
  92: [{ darts: ["T20", "D16"], totalPoints: 92 }],
  91: [{ darts: ["T17", "D20"], totalPoints: 91 }],
  90: [{ darts: ["T18", "D18"], totalPoints: 90 }],
  89: [{ darts: ["T19", "D16"], totalPoints: 89 }],
  88: [{ darts: ["T20", "D14"], totalPoints: 88 }],
  87: [{ darts: ["T17", "D18"], totalPoints: 87 }],
  86: [{ darts: ["T18", "D16"], totalPoints: 86 }],
  85: [{ darts: ["T19", "D14"], totalPoints: 85 }],
  84: [{ darts: ["T20", "D12"], totalPoints: 84 }],
  83: [{ darts: ["T17", "D16"], totalPoints: 83 }],
  82: [{ darts: ["T14", "D20"], totalPoints: 82 }],
  81: [{ darts: ["T19", "D12"], totalPoints: 81 }],
  80: [{ darts: ["T20", "D10"], totalPoints: 80 }],
  79: [{ darts: ["T19", "D11"], totalPoints: 79 }],
  78: [{ darts: ["T18", "D12"], totalPoints: 78 }],
  77: [{ darts: ["T19", "D10"], totalPoints: 77 }],
  76: [{ darts: ["T20", "D8"], totalPoints: 76 }],
  75: [{ darts: ["T17", "D12"], totalPoints: 75 }],
  74: [{ darts: ["T14", "D16"], totalPoints: 74 }],
  73: [{ darts: ["T19", "D8"], totalPoints: 73 }],
  72: [{ darts: ["T16", "D12"], totalPoints: 72 }],
  71: [{ darts: ["T13", "D16"], totalPoints: 71 }],
  70: [{ darts: ["T18", "D8"], totalPoints: 70 }],
  69: [{ darts: ["T19", "D6"], totalPoints: 69 }],
  68: [{ darts: ["T20", "D4"], totalPoints: 68 }],
  67: [{ darts: ["T17", "D8"], totalPoints: 67 }],
  66: [{ darts: ["T10", "D18"], totalPoints: 66 }],
  65: [{ darts: ["T19", "D4"], totalPoints: 65 }],
  64: [{ darts: ["T16", "D8"], totalPoints: 64 }],
  63: [{ darts: ["T13", "D12"], totalPoints: 63 }],
  62: [{ darts: ["T10", "D16"], totalPoints: 62 }],
  61: [{ darts: ["T15", "D8"], totalPoints: 61 }],
  60: [{ darts: ["20", "D20"], totalPoints: 60 }],
  59: [{ darts: ["19", "D20"], totalPoints: 59 }],
  58: [{ darts: ["18", "D20"], totalPoints: 58 }],
  57: [{ darts: ["17", "D20"], totalPoints: 57 }],
  56: [{ darts: ["16", "D20"], totalPoints: 56 }],
  55: [{ darts: ["15", "D20"], totalPoints: 55 }],
  54: [{ darts: ["14", "D20"], totalPoints: 54 }],
  53: [{ darts: ["13", "D20"], totalPoints: 53 }],
  52: [{ darts: ["12", "D20"], totalPoints: 52 }],
  51: [{ darts: ["11", "D20"], totalPoints: 51 }],
  50: [{ darts: ["10", "D20"], totalPoints: 50 }],
  49: [{ darts: ["9", "D20"], totalPoints: 49 }],
  48: [{ darts: ["8", "D20"], totalPoints: 48 }],
  47: [{ darts: ["15", "D16"], totalPoints: 47 }],
  46: [{ darts: ["6", "D20"], totalPoints: 46 }],
  45: [{ darts: ["13", "D16"], totalPoints: 45 }],
  44: [{ darts: ["12", "D16"], totalPoints: 44 }],
  43: [{ darts: ["11", "D16"], totalPoints: 43 }],
  42: [{ darts: ["10", "D16"], totalPoints: 42 }],
  41: [{ darts: ["9", "D16"], totalPoints: 41 }],
  40: [{ darts: ["D20"], totalPoints: 40 }],
  38: [{ darts: ["D19"], totalPoints: 38 }],
  36: [{ darts: ["D18"], totalPoints: 36 }],
  34: [{ darts: ["D17"], totalPoints: 34 }],
  32: [{ darts: ["D16"], totalPoints: 32 }],
  30: [{ darts: ["D15"], totalPoints: 30 }],
  28: [{ darts: ["D14"], totalPoints: 28 }],
  26: [{ darts: ["D13"], totalPoints: 26 }],
  24: [{ darts: ["D12"], totalPoints: 24 }],
  22: [{ darts: ["D11"], totalPoints: 22 }],
  20: [{ darts: ["D10"], totalPoints: 20 }],
  18: [{ darts: ["D9"], totalPoints: 18 }],
  16: [{ darts: ["D8"], totalPoints: 16 }],
  14: [{ darts: ["D7"], totalPoints: 14 }],
  12: [{ darts: ["D6"], totalPoints: 12 }],
  10: [{ darts: ["D5"], totalPoints: 10 }],
  8: [{ darts: ["D4"], totalPoints: 8 }],
  6: [{ darts: ["D3"], totalPoints: 6 }],
  4: [{ darts: ["D2"], totalPoints: 4 }],
  2: [{ darts: ["D1"], totalPoints: 2 }],
};
