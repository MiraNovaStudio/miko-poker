# 🗺️ MikoPoker Development Roadmap

This roadmap defines the development milestones and strategic direction for the **MikoPoker** project.  
It ensures all team members share a unified understanding of project goals, priorities, and release phases.

---

## 🎯 Project Vision

**MikoPoker** is a cross-platform poker training application designed to help players improve their real-world poker skills through AI-driven gameplay and analytics.  
Players will face lifelike opponents in authentic game formats — **Cash Games**, **Sit’n’Gos**, and **Tournaments** — using **play money only**, with deep statistical tracking to measure progress.

The app replicates the online card room experience and prepares users for playing against real people for real stakes.

---

## 🧠 Key Features

- **Realistic Game Formats**
  - Cash Games with continuous blinds and rebuys  
  - Sit’n’Gos with single-table elimination  
  - Multi-table Tournaments with **Big Blind Antes**  

- **Adaptive AI Opponents**
  - Configurable styles and difficulty levels  
  - Independent AI player instances  
  - Dynamic decision-making that mimics real online opponents  

- **Player Analytics**
  - VPIP, PFR, Aggression Factor, Showdown Win Rate  
  - Positional stats, hand histories, and skill progression graphs  

- **Cross-Platform Builds**
  - Windows (desktop)
  - Android (mobile)
  - iOS (via macOS + Xcode)

- **Future Features**
  - “AI Coach” mode offering strategic feedback  
  - Expanded analytics and recommendation engine  
  - Optional cloud save for account-based data storage  

---

## 🛠️ Technology Stack

| Layer | Technology | Responsibility |
|-------|-------------|----------------|
| **Core Engine** | TypeScript | Game logic, betting, AI, hand evaluation |
| **UI Layer** | Cocos Creator (TypeScript) | Scene management, visuals, animations |
| **Persistence** | Local Storage / SQLite | Player stats, profiles, configurations |
| **Analytics** | Custom Module | Player development and stat aggregation |
| **Deployment** | Cocos Export Targets | Windows EXE, Android APK, iOS IPA |

---

## 📅 Development Phases

### **Phase 1 — Core Engine & Game Logic**
**Status:** In Progress  
**Lead:** Claude  
**Goal:** Finalize the core gameplay foundation.

**Tasks**
- [x] Implement small/big blind logic  
- [ ] Add **Big Blind Ante** for tournaments only  
- [ ] Add `GameConfig` field for game type (`cash`, `sng`, `tournament`)  
- [ ] Add `BlindStructure` interface for tournaments  
- [ ] Modularize AI under `/src/ai/` directory  
- [ ] Implement event hooks (`onBlindPosted`, `onLevelChange`, `onGameModeChanged`)  
- [ ] Add automated unit tests for blind posting and betting logic  

**Deliverable:** Engine v0.2.0 — stable, extensible game logic ready for UI integration.

---

### **Phase 2 — Cocos UI Integration**
**Status:** Pending  
**Lead:** Michael (with ChatGPT architectural support)  
**Goal:** Integrate the engine into a fully functional, visual interface.

**Tasks**
- [ ] Build primary **Table Scene** with dealer button and blinds indicators  
- [ ] Implement **Player HUDs** showing stack size, action buttons, and timers  
- [ ] Add chip animations, bet indicators, and pot display  
- [ ] Create reusable components for cards, chips, and status messages  
- [ ] Integrate engine events into the Cocos scene  
- [ ] Build an internal debug/test scene for rapid iteration  

**Deliverable:** UI-integrated **Alpha Build v0.3.0**

---

### **Phase 3 — Multi-Platform Packaging & Analytics**
**Status:** Upcoming  
**Lead:** Michael (builds), ChatGPT (toolchain setup)  
**Goal:** Release-ready packaging for all target platforms.

**Tasks**
- [ ] Configure Cocos Creator export for Windows, Android, and iOS  
- [ ] Set up Xcode build and signing for iOS deployment (requires macOS)  
- [ ] Implement player analytics and stat tracking systems  
- [ ] Add player profile management and data persistence  
- [ ] Perform optimization and compression for mobile builds  
- [ ] Conduct beta testing and collect feedback  

**Deliverable:** Cross-platform **Beta Build v0.5.0** ready for app store submission.

---

## 🚀 Long-Term Goals
- “AI Coach” system for personalized strategy feedback  
- Deep analytics module to identify leaks in player strategy  
- Recommendation engine that suggests study areas or adjustments  
- Optional cloud save for player stats and progression  
- Continued improvements to AI realism and adaptability  

---

## 🧭 Version Targets
| Version | Milestone | Description |
|----------|------------|-------------|
| **v0.2.0** | Engine Stable | Full blind/ante system, AI modularization |
| **v0.3.0** | UI Alpha | Visual gameplay experience in Cocos |
| **v0.5.0** | Beta Release | Multi-platform packaging + analytics |
| **v1.0.0** | Public Launch | Fully featured single-player poker trainer |
| **v1.5.0+** | Post-Launch | Advanced player analytics, AI coaching system, optional cloud sync (no leaderboards or multiplayer) |

---

### Contributors
- **Michael** — Product Owner / UI Integrator  
- **Claude** — Senior Software Engineer  
- **ChatGPT** — Architect / Code Reviewer  

---

