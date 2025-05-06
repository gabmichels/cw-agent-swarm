# 🧠 ROADMAP.md – Multi-Agent System Maturity Plan

---

## 🧭 Phase 1: Observability & Memory Maturity (Weeks 1–2)  
**Goal:** Turn the platform from robust to fully observable, auditable, and self-aware.

✅ Agent Dashboard UI  
✅ Memory Layer Upgrade  
✅ Ethics Middleware v1  

---

## 🧭 Phase 2: Execution Resilience + Coordination Scaling (Weeks 3–5)  
**Goal:** Prepare the system for intelligent task routing under load.

✅ Execution Hardening  
✅ Coordinator Health & Capability  

---

## 🧭 Phase 3: MCP Runtime Layer (Weeks 6–7)  
**Goal:** Introduce orchestration, modularity, and runtime control across all agents.

✅ Agent Capability Discovery  
- Implemented `AgentCapabilityRegistry`  
- Extended `AgentBase` with capabilities, roles, tags  
- Integrated dynamic matching into `AgentCoordinator`  
- Created standard skill definitions and demo suite  
- Documented matching system and future extensibility  

🔜 Task: Agent Control Plane Setup  
- Create `MCPRuntime.ts` for registration, routing, and lifecycle  
- Centralize registry of active/idle/failed agents  

🔜 Task: Global Task Routing  
- Dispatch tasks via MCP based on skill, load, health  

🔜 Task: Scalable Agent Bootstrapping  
- Chloe suggests new agents  
- UI generates config stubs + MD docs  
- MCP supports spawning + onboarding flows  

---

## 🧭 Phase 4: Analytics + Governance (Post-MCP, Optional Weeks 8–9)  
**Goal:** Expand from introspection to intelligence + oversight.

🔜 AgentMonitor Storage + AgentStats  
🔜 Ethical Governance Layer  
