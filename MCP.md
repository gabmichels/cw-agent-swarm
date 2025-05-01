# 🧠 MCP.md – Multi-Agent Control Plane (MCP) Design

## 🎯 Goal:
Establish a centralized, pluggable runtime layer to register, orchestrate, and route tasks across a dynamic pool of autonomous agents.

---

## 🧱 Module 1: Agent Lifecycle & Registry
**Status: 🔜 Not Started**

- MCP maintains live registry of all running agents
- Agents register with: `id`, `capabilities`, `quota`, `persona`, `roles`, `tags`
- Track: `lastSeen`, `activeTasks`, `healthStatus`

---

## 🧱 Module 2: Task Routing Engine  
**Status: 🔜 Not Started**

- MCP receives task requests from coordinators (e.g., Chloe)
- Matches based on:
  - Capabilities
  - Health status
  - Current load
- Returns best-fit agent or fallback
- Optionally logs full routing decision

---

## ✅ Module 3: Capability Discovery Layer  
**Status: ✅ Completed**

- Each agent declares its capabilities, domains, tags
- Centralized `AgentCapabilityRegistry` supports matching
- Coordinators use this for dynamic delegation
- Demonstration and documentation completed

---

## 🧱 Module 4: Agent Bootstrapping Interface  
**Status: 🔜 Not Started**

- Accept `AgentManifest.json` or `AgentProfile.md`
- Spawn or scaffold agent directory and config
- Integrate with Chloe’s suggestion + UI generator

---

## 🧱 Module 5 (Optional): MCP UI Panel  
**Status: 💤 Deferred**

- Visualize live agent pool, routing decisions, metadata
- Trigger spawn/decommission
- Surface quota, health, and routing logs

---

## ✅ Capability System Dependencies (Already Done)

- `AgentCapabilityRegistry.ts`
- `AgentHealthChecker.ts`
- `AgentMonitor.ts`
- `AgentBase` extensions for roles/capabilities

---

## 📍 Next Step:
Scaffold `MCPRuntime.ts` to unify agent registry, routing, and lifecycle control. Chloe and coordinators will route tasks via MCP instead of static lists.
