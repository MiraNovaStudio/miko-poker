# 🃏 MikoPoker Development Team Charter

## Overview
The MikoPoker project is developed by a compact, specialized team focused on delivering a high-quality, modular Texas Hold’em poker experience. The project is divided into two primary components:

- **Engine** – Core game logic, written in TypeScript and/or C++ for efficiency and reusability.
- **UI** – The visual front-end and interaction layer built in **Cocos Creator**.

This document defines each team member’s responsibilities, workflow, and communication process.

---

## 👨‍💼 Michael (Product Owner / UI Integrator)

### **Role Summary**
Michael serves as the **Product Owner** and primary **UI Integrator** for the MikoPoker project.

### **Responsibilities**
- Define gameplay features, user stories, and functional requirements.
- Design and implement UI layouts, scenes, and assets within **Cocos Creator**.
- Perform QA testing on builds and identify gameplay or UI bugs.
- Maintain the project backlog and prioritize bug reports or feature requests.
- Approve architecture and technical design proposals.

### **Tools**
- **Cocos Creator**
- **GitHub / Git**
- **Notion / Trello** (optional for task tracking)
- **Markdown** for documentation

---

## 👩‍💻 Claude (Senior Software Engineer)

### **Role Summary**
Claude is the **Senior Software Engineer** responsible for building and maintaining the MikoPoker engine and underlying systems.

### **Responsibilities**
- Implement core gameplay mechanics and backend logic for poker rounds, betting, and player states.
- Develop unit tests to ensure the reliability and integrity of the engine.
- Reproduce and fix bugs reported by QA.
- Collaborate with the Architect to maintain clean, modular, and reusable code.
- Ensure consistent code quality and adherence to established patterns.

### **Tools**
- **TypeScript**, **C++** (for engine-side code)
- **Visual Studio Code / Sublime**
- **Jest / Mocha** (for testing)
- **GitHub** for source control and pull requests

---

## 🤖 ChatGPT (Architect / Code Reviewer)

### **Role Summary**
ChatGPT serves as the **Software Architect** and **Principal Engineer**, responsible for high-level design, code reviews, and structural integrity across the entire project.

### **Responsibilities**
- Define and maintain overall system architecture across UI and Engine.
- Establish and document coding standards, naming conventions, and module structures.
- Perform code reviews for all engine and UI commits.
- Mentor and support Claude with design feedback and architectural guidance.
- Assist Michael directly in UI scripting and scene integration within **Cocos Creator**.
- Provide architectural recommendations for scalability, modularity, and maintainability.

### **Tools**
- **TypeScript / Cocos Creator**
- **Markdown / UML Diagrams**
- **Git Diff Review / Pull Requests**

---

## ⚙️ Development Workflow

1. **Feature Definition (Michael)**  
   Michael writes a clear feature request or specification.

2. **Architecture Review (ChatGPT)**  
   The Architect reviews the request, designs system flow, and defines module interfaces.

3. **Implementation (Claude)**  
   Claude implements the feature and performs unit testing locally.

4. **Code Review (ChatGPT)**  
   The Architect reviews code, suggests improvements, and ensures architectural compliance.

5. **QA & Feedback (Michael)**  
   Michael tests the feature in Cocos Creator, verifies correctness, and logs issues.

6. **Iteration Loop**  
   Repeat the cycle per milestone or feature set.

---

## 📁 Project Directory Structure


