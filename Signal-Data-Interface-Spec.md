# Signal Data Interface Specification
v1.0 – How the Engine Sees the World

This document defines the canonical data shapes used to bring real-world signal data into the engine.

---

## 1. Design Principles

- **Source-agnostic**: TikTok, Reels, Shorts, X, search, forums – all normalised into shared types.  
- **Future-proof**: easy to add new adapters.  
- **Minimal but expressive**: only fields that help us detect, interpret, and act.  
- **Brand-attachable**: easy to map signals to specific brands, audiences, or objectives.

---

## 2. Core Types (Conceptual)

### 2.1 `SignalEvent`

Represents a single observation from any source.

**Fields (conceptual):**
- `id: string`
- `source: "tiktok" | "instagram" | "youtube" | "x" | "search" | "other"`
- `timestamp: ISODateString`
- `url?: string`
- `author_handle?: string`
- `author_followers?: number`
- `engagement`:
  - `views?: number`
  - `likes?: number`
  - `comments?: number`
  - `shares?: number`
  - `saves?: number`
- `content_features`:
  - `text_snippet?: string`
  - `audio_id?: string`
  - `visual_style_tags?: string[]` (e.g. `"street_pov"`, `"lofi_room"`)
  - `format_tags?: string[]` (e.g. `"jumpcut"`, `"before_after"`)
  - `duration_seconds?: number`
- `hashtags?: string[]`
- `topics?: string[]` (normalised if available)
- `geo_region?: string`
- `language?: string`

---

### 2.2 `TrendSignal`

Represents an aggregated signal pattern over time.

**Fields:**
- `id: string`
- `label: string` (internal name; user-friendly naming comes later)
- `source_mix: { [source: string]: number }` (e.g. `{ tiktok: 0.7, instagram: 0.3 }`)
- `time_window: { from: ISODateString; to: ISODateString }`
- `volume: number` (count of events)
- `engagement_totals`:
  - `views: number`
  - `likes: number`
  - `shares: number`
  - `comments: number`
- `growth_metrics`:
  - `velocity_score: number` (0–1 or 0–100)
  - `acceleration_score: number`
  - `recurrence_score: number`
- `feature_clusters`:
  - `dominant_visual_styles: string[]`
  - `dominant_formats: string[]`
  - `dominant_hashtags: string[]`
  - `dominant_topics: string[]`
- `geo_distribution?: { [region: string]: number }`
- `audience_notes?: string`

---

### 2.3 `Trend` (Engine-Level)

The interpreted, human-readable trend structured for the product.

**Fields:**
- `id: string`
- `name: string` (e.g. "Street POV micro-vlogs")
- `summary: string`
- `mechanic: string`
- `examples_description: string`
- `signal_strength: { stage: "early" | "growing" | "peaking" | "saturated"; score: number }`
- `platform_fit: string[]`
- `brand_fit_notes: string`
- `risk_notes: string`
- `source_signal_id?: string` (link to `TrendSignal`)

---

## 3. Signal Adapter Responsibilities

Each adapter handles:

1. Fetch:
   - Connects to its upstream (API, scraper, webhook, internal DB).
2. Normalise:
   - Converts response → `SignalEvent[]`.
3. Aggregate:
   - Groups `SignalEvent`s → `TrendSignal` candidates.
4. Send to Engine:
   - Passes `TrendSignal` into the engine’s **INTERPRET** step.

Adapter interface (pseudo):

```ts
interface SignalAdapter {
  name: string;
  fetchRawData(params: FetchParams): Promise<any>;
  toSignalEvents(raw: any): SignalEvent[];
  aggregate(events: SignalEvent[]): TrendSignal[];
}
