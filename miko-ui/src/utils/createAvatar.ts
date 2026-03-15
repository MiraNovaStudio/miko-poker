// (c) 2026 MiraNova Studios
/**
 * Procedural avatar generator — creates unique player avatars at runtime
 * using PixiJS Graphics primitives. Randomness is seeded from the player
 * name so the same name always produces the same avatar.
 */

import { Container, Graphics } from 'pixi.js';
import type { Gender } from '../data/player-roster';

// ─── Avatar presets for player selection ─────────────────────────

export interface AvatarPreset {
  id: string;
  label: string;
  seed: string;
  gender: Gender;
}

/**
 * Six fixed avatar presets the player can choose from.
 * Each uses a deterministic seed so the avatar never changes.
 */
export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'male1',    label: 'Guy 1',    seed: 'preset_male_light',    gender: 'male' },
  { id: 'male2',    label: 'Guy 2',    seed: 'preset_male_dark',     gender: 'male' },
  { id: 'male3',    label: 'Guy 3',    seed: 'preset_male_tan',      gender: 'male' },
  { id: 'female1',  label: 'Gal 1',    seed: 'preset_female_light',  gender: 'female' },
  { id: 'female2',  label: 'Gal 2',    seed: 'preset_female_dark',   gender: 'female' },
  { id: 'female3',  label: 'Gal 3',    seed: 'preset_female_tan',    gender: 'female' },
];

// ─── Seeded PRNG ──────────────────────────────────────────────────

/** Simple seeded random number generator (mulberry32). */
function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic hash from a name string. */
function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ─── Color palettes ───────────────────────────────────────────────

const SKIN_TONES = [
  0xfde7c5, // light
  0xf5c999, // fair
  0xe0a370, // medium
  0xc68642, // tan
  0x8d5524, // brown
  0x614335, // dark
];

const SHIRT_COLORS = [
  0x3b82f6, // blue
  0xef4444, // red
  0x22c55e, // green
  0xa855f7, // purple
  0xf97316, // orange
  0x06b6d4, // cyan
  0xec4899, // pink
  0x6366f1, // indigo
  0x78716c, // stone
  0x1e293b, // dark slate
];

const HAT_COLORS = [
  0x1e293b, // dark
  0x991b1b, // dark red
  0x1e3a5f, // navy
  0x3f6212, // olive
  0x78350f, // brown
  0x581c87, // deep purple
];

const GLASSES_COLOR = 0x1a1a2e;

const EYE_COLORS = [
  0x3b2f1e, // brown
  0x2563eb, // blue
  0x16a34a, // green
  0x6b7280, // gray
];

const HAIR_COLORS = [
  0x1a1209, // black
  0x3b2314, // dark brown
  0x6b3a1f, // brown
  0x8b4513, // medium brown
  0xb87333, // auburn
  0xd4a44c, // dirty blonde
  0xe8c872, // blonde
  0xc0c0c0, // gray/silver
  0x8b0000, // dark red
];

// ─── Avatar dimensions ────────────────────────────────────────────

const AVATAR_SIZE = 48; // rendered size of the avatar container
const HEAD_RADIUS = 18;
const HEAD_CY = -4;

// ─── Feature builders ─────────────────────────────────────────────

function drawHead(g: Graphics, skinColor: number): void {
  g.circle(0, HEAD_CY, HEAD_RADIUS);
  g.fill(skinColor);
}

function drawEyes(g: Graphics, eyeColor: number): void {
  const eyeY = HEAD_CY - 2;
  const eyeSpacing = 7;
  const eyeRadius = 3;
  const pupilRadius = 1.5;

  // Whites
  g.circle(-eyeSpacing, eyeY, eyeRadius);
  g.circle(eyeSpacing, eyeY, eyeRadius);
  g.fill(0xffffff);

  // Pupils
  g.circle(-eyeSpacing, eyeY, pupilRadius);
  g.circle(eyeSpacing, eyeY, pupilRadius);
  g.fill(eyeColor);
}

function drawMouth(g: Graphics, rng: () => number, skinColor: number): void {
  const mouthY = HEAD_CY + 9;
  const mouthWidth = 8 + rng() * 4;
  const mouthHeight = 2 + rng() * 2;
  const smiling = rng() > 0.4;

  if (smiling) {
    // Simple smile arc
    g.roundRect(-mouthWidth / 2, mouthY, mouthWidth, mouthHeight, 2);
    g.fill(0xc0392b);
  } else {
    // Neutral line
    g.rect(-mouthWidth / 2, mouthY, mouthWidth, 1.5);
    g.fill(darken(skinColor, 0.3));
  }
}

function drawBody(g: Graphics, shirtColor: number): void {
  // Simple rounded shirt/torso at bottom
  const bodyTop = HEAD_CY + HEAD_RADIUS - 2;
  g.roundRect(-16, bodyTop, 32, 16, 4);
  g.fill(shirtColor);
}

// ─── Optional features ────────────────────────────────────────────

function drawHat(g: Graphics, hatColor: number, rng: () => number): void {
  const hatStyle = rng();
  const hatTop = HEAD_CY - HEAD_RADIUS;

  if (hatStyle < 0.5) {
    // Baseball cap
    g.roundRect(-14, hatTop - 6, 28, 10, 3);
    g.fill(hatColor);
    // Brim
    g.rect(-18, hatTop + 2, 22, 3);
    g.fill(hatColor);
  } else {
    // Beanie
    g.roundRect(-15, hatTop - 8, 30, 14, 6);
    g.fill(hatColor);
  }
}

function drawSunglasses(g: Graphics): void {
  const glassY = HEAD_CY - 3;
  // Left lens
  g.roundRect(-12, glassY - 3, 10, 7, 2);
  g.fill(GLASSES_COLOR);
  // Right lens
  g.roundRect(2, glassY - 3, 10, 7, 2);
  g.fill(GLASSES_COLOR);
  // Bridge
  g.rect(-2, glassY - 1, 4, 2);
  g.fill(GLASSES_COLOR);
}

function drawBeard(g: Graphics, skinColor: number, rng: () => number): void {
  const beardColor = darken(skinColor, 0.35);
  const beardStyle = rng();

  if (beardStyle < 0.5) {
    // Full beard
    g.roundRect(-12, HEAD_CY + 6, 24, 14, 6);
    g.fill(beardColor);
  } else {
    // Goatee
    g.roundRect(-5, HEAD_CY + 8, 10, 10, 4);
    g.fill(beardColor);
  }
}

// ─── Hair styles ─────────────────────────────────────────────────

/** Short cropped hair — sits on top of the head like a cap. */
function drawShortHair(g: Graphics, hairColor: number): void {
  const top = HEAD_CY - HEAD_RADIUS;
  // Rounded top section covering upper half of head
  g.roundRect(-HEAD_RADIUS + 1, top - 2, HEAD_RADIUS * 2 - 2, HEAD_RADIUS * 0.9, 10);
  g.fill(hairColor);
}

/** Side-parted medium hair — covers top and comes down the sides a bit. */
function drawMediumHair(g: Graphics, hairColor: number, rng: () => number): void {
  const top = HEAD_CY - HEAD_RADIUS;
  const partLeft = rng() < 0.5;

  // Top mass
  g.roundRect(-HEAD_RADIUS, top - 3, HEAD_RADIUS * 2, HEAD_RADIUS * 0.8, 8);
  g.fill(hairColor);

  // Side that's fuller (opposite of part)
  if (partLeft) {
    g.roundRect(HEAD_RADIUS - 6, top + 2, 7, HEAD_RADIUS * 1.1, 3);
    g.fill(hairColor);
  } else {
    g.roundRect(-HEAD_RADIUS - 1, top + 2, 7, HEAD_RADIUS * 1.1, 3);
    g.fill(hairColor);
  }
}

/** Longer hair — flows down past the ears, good for female avatars. */
function drawLongHair(g: Graphics, hairColor: number): void {
  const top = HEAD_CY - HEAD_RADIUS;

  // Top volume
  g.roundRect(-HEAD_RADIUS - 1, top - 4, HEAD_RADIUS * 2 + 2, HEAD_RADIUS * 0.9, 10);
  g.fill(hairColor);

  // Left side flowing down
  g.roundRect(-HEAD_RADIUS - 3, top + 2, 8, HEAD_RADIUS * 1.8, 4);
  g.fill(hairColor);

  // Right side flowing down
  g.roundRect(HEAD_RADIUS - 5, top + 2, 8, HEAD_RADIUS * 1.8, 4);
  g.fill(hairColor);
}

/** Spiky / messy short hair. */
function drawSpikyHair(g: Graphics, hairColor: number, rng: () => number): void {
  const top = HEAD_CY - HEAD_RADIUS;

  // Base
  g.roundRect(-HEAD_RADIUS + 2, top - 2, HEAD_RADIUS * 2 - 4, HEAD_RADIUS * 0.7, 6);
  g.fill(hairColor);

  // Spikes
  const spikeCount = 3 + Math.floor(rng() * 3);
  const spread = (HEAD_RADIUS * 2 - 8) / spikeCount;
  for (let i = 0; i < spikeCount; i++) {
    const sx = -HEAD_RADIUS + 5 + i * spread + (rng() - 0.5) * 3;
    const sHeight = 4 + rng() * 5;
    g.moveTo(sx - 2, top);
    g.lineTo(sx, top - sHeight);
    g.lineTo(sx + 2, top);
    g.closePath();
    g.fill(hairColor);
  }
}

/** Curly / afro-like volume. */
function drawCurlyHair(g: Graphics, hairColor: number): void {
  const top = HEAD_CY - HEAD_RADIUS;

  // Big rounded puff on top
  g.ellipse(0, top + 2, HEAD_RADIUS + 2, HEAD_RADIUS * 0.6);
  g.fill(hairColor);

  // Side volume
  g.ellipse(-HEAD_RADIUS + 2, HEAD_CY - 4, 6, 10);
  g.fill(hairColor);
  g.ellipse(HEAD_RADIUS - 2, HEAD_CY - 4, 6, 10);
  g.fill(hairColor);
}

function drawEarrings(g: Graphics): void {
  g.circle(-HEAD_RADIUS - 1, HEAD_CY + 2, 2);
  g.circle(HEAD_RADIUS + 1, HEAD_CY + 2, 2);
  g.fill(0xffd700); // gold
}

function drawHeadband(g: Graphics, rng: () => number): void {
  const color = rng() > 0.5 ? 0xef4444 : 0xfbbf24;
  const bandY = HEAD_CY - HEAD_RADIUS + 5;
  g.rect(-HEAD_RADIUS, bandY, HEAD_RADIUS * 2, 3);
  g.fill(color);
}

// ─── Utility ──────────────────────────────────────────────────────

function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount)) | 0;
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount)) | 0;
  const b = Math.max(0, (color & 0xff) * (1 - amount)) | 0;
  return (r << 16) | (g << 8) | b;
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Create a procedural avatar Container for a player.
 * The same name always produces the same avatar.
 * Gender controls which optional features are available:
 *   female — no beard, higher earring chance
 *   male   — no earrings, can have beard
 *
 * The returned Container is AVATAR_SIZE × AVATAR_SIZE and can be
 * converted to a texture via `renderer.generateTexture(container)`.
 */
export function createAvatar(name: string, gender: Gender = 'male'): Container {
  const seed = hashName(name);
  const rng = createRng(seed);

  const isFemale = gender === 'female';

  // Pick colors
  const skinColor = pick(SKIN_TONES, rng);
  const shirtColor = pick(SHIRT_COLORS, rng);
  const eyeColor = pick(EYE_COLORS, rng);

  // Decide which optional features to include (gender-aware)
  const hasHat = rng() < 0.35;
  const hasSunglasses = rng() < 0.25;
  const hasBeard = !isFemale && rng() < 0.30;
  const hasEarrings = isFemale ? rng() < 0.40 : false;
  const hasHeadband = !hasHat && rng() < 0.20;
  // Hair: ~25% bald, rest get hair. Skip if hat or headband covers it.
  const isBald = rng() < 0.25;
  const hasHair = !isBald && !hasHat && !hasHeadband;
  const hairColor = pick(HAIR_COLORS, rng);
  // Pick hair style: females lean toward longer styles
  const hairStyleRoll = rng();
  const hairStyle = isFemale
    ? (hairStyleRoll < 0.35 ? 'long' : hairStyleRoll < 0.55 ? 'curly' : hairStyleRoll < 0.75 ? 'medium' : 'short')
    : (hairStyleRoll < 0.30 ? 'short' : hairStyleRoll < 0.55 ? 'spiky' : hairStyleRoll < 0.75 ? 'medium' : 'curly');

  const container = new Container();
  const g = new Graphics();

  // Draw back-to-front
  drawBody(g, shirtColor);

  // Long/curly hair behind head (flows below the head circle)
  if (hasHair && (hairStyle === 'long' || hairStyle === 'curly')) {
    if (hairStyle === 'long') drawLongHair(g, hairColor);
    else drawCurlyHair(g, hairColor);
  }

  drawHead(g, skinColor);

  // Hair on top of head (drawn after head so it sits on top)
  if (hasHair) {
    switch (hairStyle) {
      case 'short': drawShortHair(g, hairColor); break;
      case 'medium': drawMediumHair(g, hairColor, rng); break;
      case 'spiky': drawSpikyHair(g, hairColor, rng); break;
      case 'long': drawShortHair(g, hairColor); break;    // top cap for long hair
      case 'curly': break;                                 // curly already drawn behind
    }
  }

  // Beard behind eyes/mouth
  if (hasBeard) drawBeard(g, skinColor, rng);

  // Face features
  if (hasSunglasses) {
    drawSunglasses(g);
  } else {
    drawEyes(g, eyeColor);
  }
  drawMouth(g, rng, skinColor);

  // Accessories
  if (hasHat) drawHat(g, pick(HAT_COLORS, rng), rng);
  if (hasHeadband) drawHeadband(g, rng);
  if (hasEarrings) drawEarrings(g);

  container.addChild(g);

  return container;
}

/** The design size of generated avatars. */
export const AVATAR_RENDER_SIZE = AVATAR_SIZE;
