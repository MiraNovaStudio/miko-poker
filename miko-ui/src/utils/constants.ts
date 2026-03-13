/** Layout and style constants ported from MikoPokerUI */

/** Seat positions for 8-max rectangular layout (origin = center of table) */
export const SEAT_POSITIONS: { x: number; y: number }[] = [
  { x: 0, y: 220 },     // Seat 0: Human (bottom center)    — flipped Y for PixiJS
  { x: -200, y: 220 },  // Seat 1: ai1 (bottom left)
  { x: -440, y: 0 },    // Seat 2: ai2 (left side)
  { x: -200, y: -220 }, // Seat 3: ai3 (top left)
  { x: 0, y: -220 },    // Seat 4: ai4 (top center)
  { x: 200, y: -220 },  // Seat 5: ai5 (top right)
  { x: 440, y: 0 },     // Seat 6: ai6 (right side)
  { x: 200, y: 220 },   // Seat 7: ai7 (bottom right)
];

/** Top-row seats where name labels go above cards */
export const TOP_ROW_SEATS = [3, 4, 5];

/** Card sizes */
export const HOLE_CARD_WIDTH = 80;
export const HOLE_CARD_HEIGHT = 112;
export const COMMUNITY_CARD_WIDTH = 100;
export const COMMUNITY_CARD_HEIGHT = 140;
export const CARD_SPACING_HOLE = 50;       // x-offset between two hole cards
export const CARD_SPACING_COMMUNITY = 116; // x-offset between community cards

/** Chip overlay bar */
export const CHIP_OVERLAY_WIDTH = 140;
export const CHIP_OVERLAY_HEIGHT = 36;
export const CHIP_OVERLAY_Y = 18;  // y-offset from slot center (below cards)

/** Dealer button */
export const DEALER_BUTTON_SIZE = 30;

/** Per-seat dealer button offsets — always positioned on the table toward center */
export const DEALER_BUTTON_OFFSETS: { x: number; y: number }[] = [
  { x: 50, y: -70 },   // Seat 0: bottom center → up-right
  { x: 70, y: -70 },   // Seat 1: bottom left → up-right
  { x: 80, y: -30 },   // Seat 2: left side → right
  { x: 70, y: 60 },    // Seat 3: top left → down-right
  { x: 50, y: 60 },    // Seat 4: top center → down
  { x: -70, y: 60 },   // Seat 5: top right → down-left
  { x: -80, y: -30 },  // Seat 6: right side → left
  { x: -70, y: -70 },  // Seat 7: bottom right → up-left
];

/** Colors */
export const COLORS = {
  white: 0xffffff,
  yellow: 0xffff00,
  black: 0x000000,
  darkGray: 0x333333,
  statusRed: 0xff6464,
  activeGreen: 0x3cb58f,
  bgDark: 0x1a1a2e,
  betText: 0xffffff,
  potText: 0xffff00,
  handLabelBlue: 0x88ccff,
} as const;

/** Font styles */
export const FONTS = {
  playerName: { fontFamily: 'Arial', fontSize: 16, fill: COLORS.white },
  chipStack: { fontFamily: 'Arial', fontSize: 24, fontWeight: 'bold' as const, fill: COLORS.yellow },
  betLabel: { fontFamily: 'Arial', fontSize: 24, fill: COLORS.white, stroke: { color: COLORS.black, width: 2 } },
  statusLabel: { fontFamily: 'Arial', fontSize: 14, fill: COLORS.statusRed, stroke: { color: COLORS.black, width: 1 } },
  potLabel: { fontFamily: 'Arial', fontSize: 22, fill: COLORS.potText },
  statusBar: { fontFamily: 'Arial', fontSize: 20, fill: COLORS.white },
  handLabel: { fontFamily: 'Arial', fontSize: 18, fill: COLORS.handLabelBlue },
  button: { fontFamily: 'Arial', fontSize: 20, fill: COLORS.white },
} as const;

/** Bet label offsets by seat region */
export function getBetLabelOffset(seatIndex: number, seatPos: { x: number; y: number }): { x: number; y: number } {
  // Top-row seats: below chips
  if (seatIndex === 3 || seatIndex === 4 || seatIndex === 5) {
    return { x: 0, y: 75 };
  }
  // Bottom players: above cards
  if (seatPos.y > 100) {
    return { x: 0, y: -120 };
  }
  // Side players
  if (seatPos.x < 0) {
    return { x: 120, y: 0 }; // left side → label to right
  }
  if (seatPos.x > 0) {
    return { x: -120, y: 0 }; // right side → label to left
  }
  return { x: 0, y: -120 };
}

/** Rank map for card asset filenames */
export const RANK_TO_FILENAME: Record<string, string> = {
  'A': 'ace', 'K': 'king', 'Q': 'queen', 'J': 'jack',
  '10': '10', '9': '9', '8': '8', '7': '7',
  '6': '6', '5': '5', '4': '4', '3': '3', '2': '2',
};

/** Build the asset path for a card face */
export function getCardAssetPath(rank: string, suit: string): string {
  const rankName = RANK_TO_FILENAME[rank] || rank.toLowerCase();
  return `assets/cards/${rankName}_of_${suit}.png`;
}

/** Game config defaults */
export const GAME_CONFIG = {
  smallBlind: 5,
  bigBlind: 10,
  startingChips: 1000,
  maxPlayers: 8,
  aiThinkingDelayMin: 0.3,
  aiThinkingDelayMax: 2.0,
} as const;
