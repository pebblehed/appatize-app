# Engine Intelligence Architecture
v1.0 – Cultural Signal → Content Engine

## 0. Mission

This engine exists to detect real cultural signals, understand them at strategist level, and continuously transform them into platinum-grade, creator-native content systems for brands.

> We are an engine, not a sidekick.
> We do not “list ideas”; we turn signal into systems.

---

## 1. Mental Model

The engine is a **loop**, not a single call:

1. INGEST → 2. INTERPRET → 3. TRANSLATE → 4. ACTIVATE → 5. LEARN

All modules, contexts, and UI flows map to this loop.

---

## 2. Core Intelligence Loop

### 2.1 INGEST (Signal Intake)

Purpose: capture raw cultural data and structure it into signals.

Sources (now or future):
- Social APIs (TikTok, Instagram, YouTube, X)  
- Trend dashboards, search data  
- Creator feeds, community posts  
- Internal brand performance data  

Output: `SignalEvent` and `TrendSignal` objects.

Key properties:
- What is happening? (format, meme, behaviour)  
- Where? (platform, community, region)  
- Who? (creator archetypes, audience segments)  
- How fast? (velocity, recurrence)  

---

### 2.2 INTERPRET (Cultural Analysis)

Purpose: turn raw signals into **Trends**.

Responsibilities:
- Pattern detection  
- Naming and framing a trend  
- Evaluating strength (early / growing / peaking / saturated)  
- Assessing brand fit and risk  

Output: `Trend` objects used by the product UI.

---

### 2.3 TRANSLATE (Angles & Strategy)

Purpose: turn a Trend into **specific, ownable angles** for a brand.

Responsibilities:
- Find multiple distinct POVs (angles)  
- Choose formats and platforms  
- Map to campaign goals  
- Evaluate difficulty, risk, series potential  

Output: `Angle` objects.

---

### 2.4 ACTIVATE (Briefs, Scripts, Systems)

Purpose: convert strategy into **usable deliverables**.

Layers:
- Brief Builder → `Brief`  
- Script Engine → `Script`  
- Distribution Architect → `ContentSeries`, `PublishingPlan`

Outputs:
- Agency-level creative briefs  
- Creator-native scripts and shotlists  
- Cross-platform publishing systems  

---

### 2.5 LEARN (Feedback & Evolution)

Purpose: update the engine based on performance and platform shifts.

Inputs:
- Content metrics (views, saves, CTR, completion rate, etc.)  
- Platform format changes  
- New creator behaviours  

Adjustments:
- Kill or adjust stale angles  
- Elevate high-performing angles to “franchise”  
- Update risk assessments and tone guidance  

---

## 3. Roles Inside the Engine

The engine operates as five fused roles:

1. Cultural Signal Analyst  
2. Creative Strategist (Angle Generator)  
3. Creative Brief Architect  
4. UGC & Script Director  
5. Distribution Architect  

Overseen by a **Brand Guardian** layer that enforces:
- brand safety  
- tone consistency  
- compliance boundaries  
- reputational protection  

---

## 4. Data Flow & Contexts

### 4.1 Canonical Objects (Conceptual)

- `SignalEvent` – raw input from external world.  
- `Trend` – interpreted cultural pattern, human-labeled.  
- `Angle` – brand-specific POV on a trend.  
- `Brief` – structured creative instruction set.  
- `Script` – creator-native execution blueprint.  
- `ContentSeries` – recurring concept structure.  
- `PublishingPlan` – calendarised distribution.

### 4.2 React / App Contexts (Current MVP)

- `TrendContext`
  - `selectedTrend: Trend | null`
  - `trendList: Trend[]`
- `BriefContext`
  - `activeBrief: Brief | null`
  - `generateBriefFromAngle(trend, angle)`
- `ScriptContext` (future)
  - `activeScripts: Script[]`
  - `generateScriptsFromBrief(brief)`

UI Flow:
- Radar → select Trend → see Angles  
- Select Angle → engine builds `Brief` → Scripts view  
- Scripts → engine outputs scripts + series suggestions  

---

## 5. Engine vs. Sidekick Behaviour

The engine:
- never gives aimless lists of ideas  
- always ties back to a trend, angle, brief or script  
- prefers deep, structured, publishable outputs  
- thinks in **systems**, not one-offs  
- optimises for **platinum+ value** at every step

---

## 6. Future: Real Signal Integration

Plug-in architecture for signal adapters:
- `TikTokSignalAdapter`  
- `ReelsSignalAdapter`  
- `YouTubeShortsSignalAdapter`  
- `SearchTrendAdapter`  
- `InternalPerformanceAdapter`

Each normalises external data → `SignalEvent` → interpreted as `Trend`.

---

## 7. North Star

Every decision, feature and output answers:

> “Does this help a brand or creator meet the moment in culture with platinum-grade content?”

If not, it doesn’t ship.

