# 🗺️ MikoPoker Development Roadmap (Updated October 2025)

This roadmap defines the evolving milestones and strategic direction for the **MikoPoker** project.
It ensures all contributors share a unified understanding of goals, priorities, and release phases.

---

## 🎯 Project Vision

**MikoPoker** is a cross-platform poker simulator and training suite that delivers authentic poker experiences with AI-driven opponents.
It provides two versions:
- **Lite (Free)** — Focused on *Texas Hold’em*, ideal for casual and entry-level users.
- **Pro (Paid)** — Adds *Omaha4*, *Omaha5*, *Omaha Hi/Lo (Pot Limit)*, and *7-Card Stud*, plus analytics, player history, and full tournament modes.

Both editions emphasize play realism, configurable AI, and rich statistical tracking to improve real-world poker understanding.

---

## 💎 Edition Overview

| Feature | Lite (Free) | Pro (Paid) |
|----------|--------------|------------|
| **Game Types** | Texas Hold’em only | Hold’em, Omaha4, Omaha5, Omaha Hi/Lo, 7-Card Stud |
| **Cash Games** | One table available | Unlimited tables, multiple limits |
| **Sit’n’Go** | One available | All structures supported |
| **Tournaments** | Single event | Multi-table tournament simulation |
| **AI Difficulty Settings** | Basic (fixed speed) | Adjustable speed + advanced opponent profiles |
| **Analytics & Player History** | ✗ | ✓ |
| **Customization / Themes** | ✗ | ✓ |

---

## 🧠 Key Features

- **Realistic Game Formats**
  - Cash Games, Sit’n’Gos, Multi-Table Tournaments
  - Pot Limit and No Limit betting modes
  - Big Blind Antes (for tournaments)
- **Extended Game Variants (Pro)**
  - Omaha4, Omaha5, Omaha Hi/Lo Pot Limit, 7-Card Stud
- **Adaptive AI Opponents**
  - Configurable difficulty & speed
  - Dynamic bluffing and pattern recognition
- **Player Analytics (Pro)**
  - VPIP, PFR, AF, Winrate, Position stats, Leak tracking
- **Tournament Engine**
  - Sit’n’Go → Multi-Table scalable structure
  - Progressive blind levels, payouts, chip stacks
- **Cross-Platform Support**
  - Windows, Android, iOS (via macOS/Xcode)
- **Future Menus & Options**
  - AI Speed (slow, normal, fast)
  - AI Difficulty (casual → expert)
  - Game type, variant, and seat configuration menus

---

## 🛠️ Technology Stack

| Layer | Technology | Responsibility |
|-------|-------------|----------------|
| **Core Engine** | TypeScript | Game logic, betting, AI, multi-variant support |
| **UI Layer** | Cocos Creator (TypeScript) | Visual interface and menus |
| **Persistence** | Local Storage / SQLite | Player profiles, settings, histories |
| **Analytics** | Custom Module | Stats aggregation and visualization |
| **Deployment** | Cocos Export | Windows EXE, Android APK, iOS IPA |

---

## 📅 Development Phases

### **Phase 1 — Core Engine & Game Logic**
**Status:** In Progress
**Goal:** Finalize Hold’em foundation and modularize engine for additional variants.
**Next Additions:** Pot Limit logic, variant extensibility, tournament structure base.

**Deliverable:** Engine v0.2.5 — Stable core with variant-ready design.

---

### **Phase 2 — Cocos UI Integration**
**Status:** Active
**Goal:** Build functional Hold’em UI (cash + SNG) with animated chips, dealer button, pot tracking, and rounded HUD elements for player stacks.
Includes player HUD redesign and slot indicators.

**Deliverable:** UI Alpha v0.3.0 — Interactive Hold’em environment.

---

### **Phase 3 — Sit’n’Go & Tournament Engine**
**Status:** Upcoming
**Goal:** Implement Sit’n’Go tournaments, then extend to Multi-Table Tournament (MTT) framework.
Focus on table transitions, blind structures, and payout logic.

**Deliverable:** Tournament Alpha v0.4.0

---

### **Phase 4 — Multi-Platform Packaging & Analytics**
**Status:** Future
**Goal:** Package for all target platforms, implement player analytics, data persistence, and performance tuning.
Includes AI speed/difficulty settings in menus.

**Deliverable:** Cross-Platform Beta v0.5.0

---

### **Phase 5 — Pro Edition Expansion**
**Status:** Long-Term
**Goal:** Add Omaha4, Omaha5, Omaha Hi/Lo, and 7-Card Stud engines with shared evaluation core.
Enable player history, deeper analytics, and advanced AI profiles.

**Deliverable:** Pro Edition Launch v1.0.0

---

## 🧭 Version Targets

| Version | Milestone | Description |
|----------|------------|-------------|
| **v0.2.5** | Engine Modular | Variant-ready Hold’em engine |
| **v0.3.0** | UI Alpha | Visual gameplay + player HUDs |
| **v0.4.0** | SNG/Tournament Alpha | Tournament mode prototype |
| **v0.5.0** | Beta Release | Analytics, settings menus, cross-platform builds |
| **v1.0.0** | Pro Launch | Multi-variant support + full analytics suite |

---

### Contributors
- **Michael** — Product Owner / UI Integrator
- **Claude** — Senior Software Engineer
- **ChatGPT** — Architect / Code Reviewer
