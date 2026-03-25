// (c) 2026 MiraNova Studios
import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { FONTS } from '../utils/constants.js';

const POT_LABEL_X = -410;
const POT_LABEL_Y = -105;
const LINE_HEIGHT = 26;
const DOT_RADIUS = 5;

export class StatusBar extends Container {
  private potContainer: Container;
  private potLabel: Text;
  private statusLabel: Text;
  private handLabel: Text;
  /** Track current pot text for getPotText() */
  private _potText = 'Pot: $0';
  /** Track dot colors for each pot line row */
  private _potDotColors: number[] = [];

  constructor() {
    super();

    // Pot container holds either the simple potLabel or dot+text rows
    this.potContainer = new Container();
    this.potContainer.x = POT_LABEL_X;
    this.potContainer.y = POT_LABEL_Y;
    this.addChild(this.potContainer);

    // Default simple pot label (used when no dots needed)
    this.potLabel = new Text({ text: 'Pot: $0', style: FONTS.potLabel as TextStyleOptions });
    this.potLabel.anchor.set(0.5, 0);
    this.potContainer.addChild(this.potLabel);

    // Status label ("AI is thinking...", etc.) — bottom-left, aligned with action bar
    // StatusBar is at y=-140, action bar at y=320, so offset = 460
    this.statusLabel = new Text({ text: '', style: FONTS.statusBar as TextStyleOptions });
    this.statusLabel.anchor.set(0, 0.5);
    this.statusLabel.x = -460;
    this.statusLabel.y = 460;
    this.addChild(this.statusLabel);

    // Hand label (hand ranking) — bottom-right, aligned with action bar
    this.handLabel = new Text({ text: '', style: FONTS.handLabel as TextStyleOptions });
    this.handLabel.anchor.set(0, 0.5);
    this.handLabel.x = -460;
    this.handLabel.y = 430;
    this.addChild(this.handLabel);
  }

  /** Simple pot text (no dots) */
  setPot(text: string): void {
    this._potText = text;
    this.potContainer.removeChildren();
    this.potContainer.x = POT_LABEL_X;
    this.potLabel.text = text;
    this.potLabel.anchor.set(0.5, 0);
    this.potContainer.addChild(this.potLabel);
  }

  /** Pot text with colored dots per line. lines[i] = { text, color } */
  setPotWithDots(lines: { text: string; color: number }[]): void {
    this._potText = lines.map(l => l.text).join('\n');
    this._potDotColors = lines.map(l => l.color);
    this.potContainer.removeChildren();
    this.potContainer.x = POT_LABEL_X - 30;

    lines.forEach((line, i) => {
      const row = new Container();
      row.y = i * LINE_HEIGHT;

      // Colored dot
      const dot = new Graphics();
      dot.circle(0, 0, DOT_RADIUS);
      dot.fill({ color: line.color });
      dot.x = -DOT_RADIUS - 4;  // left of text
      dot.y = 11;  // vertically center with text (~22px font / 2)
      row.addChild(dot);

      // Text
      const label = new Text({ text: line.text, style: FONTS.potLabel as TextStyleOptions });
      label.anchor.set(0, 0);
      label.x = DOT_RADIUS;
      row.addChild(label);

      this.potContainer.addChild(row);
    });
  }

  /** Bold (enlarge) the pot label dot matching the given color */
  highlightPotDot(potColor: number): void {
    const idx = this._potDotColors.indexOf(potColor);
    if (idx < 0) return;
    const row = this.potContainer.children[idx] as Container;
    if (!row || row.children.length === 0) return;
    const dot = row.children[0] as Graphics;
    dot.clear();
    // Normal dot is radius DOT_RADIUS (5). Bold to 8 for a clear size increase.
    dot.circle(0, 0, 8);
    dot.fill({ color: potColor });
  }

  setStatus(text: string): void {
    this.statusLabel.text = text;
  }

  setHand(text: string): void {
    this.handLabel.text = text;
  }

  /** Return the visual center of the first pot line (scene coords).
   *  With anchor (0.5, 0), the top of text is at potLabel.y.
   *  First line center ≈ potLabel.y + half a line height (~11px for fontSize 22). */
  getPotLabelScenePosition(): { x: number; y: number } {
    return {
      x: this.x + POT_LABEL_X,
      y: this.y + POT_LABEL_Y + 11,
    };
  }

  /** Return the visual center of a specific pot line by index (scene coords).
   *  Index 0 = Main pot line, 1 = Side pot 1, etc. */
  getPotLineScenePosition(lineIndex: number): { x: number; y: number } {
    return {
      x: this.x + POT_LABEL_X - 30,
      y: this.y + POT_LABEL_Y + lineIndex * LINE_HEIGHT + 11,
    };
  }

  /** Return number of pot dot lines currently displayed */
  getPotLineCount(): number {
    return this._potDotColors.length;
  }

  getPotText(): string {
    return this._potText;
  }
}
