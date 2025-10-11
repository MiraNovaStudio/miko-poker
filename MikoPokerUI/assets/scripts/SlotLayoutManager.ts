/**
 * SlotLayoutManager - Creates and manages player slot positions around the poker table
 * Supports 2-max (heads-up), 4-max, 6-max, and 8-max games
 */

import { _decorator, Component, Node, Vec3, UITransform } from 'cc';

const { ccclass, property } = _decorator;

export interface SlotConfig {
    position: Vec3;
    rotation: number;  // For potential future use (rotating player UI)
    seatIndex: number;
}

@ccclass('SlotLayoutManager')
export class SlotLayoutManager extends Component {
    @property(Node)
    tableNode: Node | null = null;  // Reference to the poker table sprite node

    @property
    maxPlayers: number = 8;  // 2, 4, 6, or 8

    @property
    radiusX: number = 400;  // Horizontal radius of the ellipse

    @property
    radiusY: number = 250;  // Vertical radius of the ellipse

    @property
    heroSeatIndex: number = 0;  // Which seat is the player (usually seat 0 at bottom)

    private slots: Node[] = [];
    private slotConfigs: SlotConfig[] = [];

    start() {
        this.createSlots();
    }

    /**
     * Create player slots around the table
     */
    createSlots() {
        // Clear existing slots
        this.clearSlots();

        // Get table dimensions for reference
        const tableTransform = this.tableNode?.getComponent(UITransform);
        const tableWidth = tableTransform?.width || 800;
        const tableHeight = tableTransform?.height || 600;

        // Calculate positions based on player count
        this.slotConfigs = this.calculateSlotPositions(this.maxPlayers);

        // Create slot nodes
        for (let i = 0; i < this.slotConfigs.length; i++) {
            const config = this.slotConfigs[i];
            const slot = this.createSlotNode(i, config);
            this.slots.push(slot);
        }
    }

    /**
     * Calculate slot positions around an elliptical table
     */
    private calculateSlotPositions(playerCount: number): SlotConfig[] {
        const configs: SlotConfig[] = [];

        switch (playerCount) {
            case 2:
                // Heads-up: Player at bottom, opponent at top
                configs.push(
                    { position: new Vec3(0, -this.radiusY, 0), rotation: 0, seatIndex: 0 },
                    { position: new Vec3(0, this.radiusY, 0), rotation: 180, seatIndex: 1 }
                );
                break;

            case 4:
                // 4-max: Bottom, right, top, left
                configs.push(
                    { position: new Vec3(0, -this.radiusY, 0), rotation: 0, seatIndex: 0 },           // Bottom (player)
                    { position: new Vec3(this.radiusX, 0, 0), rotation: 270, seatIndex: 1 },          // Right
                    { position: new Vec3(0, this.radiusY, 0), rotation: 180, seatIndex: 2 },          // Top
                    { position: new Vec3(-this.radiusX, 0, 0), rotation: 90, seatIndex: 3 }           // Left
                );
                break;

            case 6:
                // 6-max: Distribute evenly around ellipse
                for (let i = 0; i < 6; i++) {
                    const angle = this.getSeatAngle(i, 6);
                    const pos = this.getEllipsePosition(angle);
                    configs.push({
                        position: pos,
                        rotation: (angle * 180 / Math.PI) + 90,
                        seatIndex: i
                    });
                }
                break;

            case 8:
                // 8-max: Distribute evenly around ellipse
                for (let i = 0; i < 8; i++) {
                    const angle = this.getSeatAngle(i, 8);
                    const pos = this.getEllipsePosition(angle);
                    configs.push({
                        position: pos,
                        rotation: (angle * 180 / Math.PI) + 90,
                        seatIndex: i
                    });
                }
                break;

            default:
                throw new Error(`Unsupported player count: ${playerCount}`);
        }

        return configs;
    }

    /**
     * Get angle for a seat position (in radians)
     * Seat 0 (player) is always at the bottom (270 degrees / 3π/2 radians)
     */
    private getSeatAngle(seatIndex: number, totalSeats: number): number {
        // Start at bottom (270 degrees = 3π/2 radians) for seat 0
        // Go clockwise (negative direction in standard math, but visually clockwise on screen)
        const startAngle = 3 * Math.PI / 2;  // 270 degrees (bottom)
        const angleStep = (2 * Math.PI) / totalSeats;
        
        return startAngle - (seatIndex * angleStep);
    }

    /**
     * Get position on ellipse for a given angle
     */
    private getEllipsePosition(angle: number): Vec3 {
        const x = this.radiusX * Math.cos(angle);
        const y = this.radiusY * Math.sin(angle);
        return new Vec3(x, y, 0);
    }

    /**
     * Create a slot node at the given position
     */
    private createSlotNode(index: number, config: SlotConfig): Node {
        const slot = new Node(`Slot_${index}`);
        slot.setParent(this.node);
        slot.setPosition(config.position);

        // Add UITransform component
        const transform = slot.addComponent(UITransform);
        transform.setContentSize(150, 100);

        return slot;
    }

    /**
     * Clear all existing slots
     */
    private clearSlots() {
        for (const slot of this.slots) {
            slot.destroy();
        }
        this.slots = [];
        this.slotConfigs = [];
    }

    /**
     * Update layout when player count changes
     */
    public updatePlayerCount(newCount: number) {
        if (newCount !== this.maxPlayers) {
            this.maxPlayers = newCount;
            this.createSlots();
        }
    }

    /**
     * Get slot node by seat index
     */
    public getSlot(seatIndex: number): Node | null {
        return this.slots[seatIndex] || null;
    }

    /**
     * Get all slot nodes
     */
    public getAllSlots(): Node[] {
        return [...this.slots];
    }

    /**
     * Get slot configuration
     */
    public getSlotConfig(seatIndex: number): SlotConfig | null {
        return this.slotConfigs[seatIndex] || null;
    }

    /**
     * Get all slot configurations
     */
    public getAllSlotConfigs(): SlotConfig[] {
        return [...this.slotConfigs];
    }
}

