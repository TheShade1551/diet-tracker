# Changelog

## v1: Foundation

### Project Core & Deployment
* **Project scaffold & routing (Vite + React Router v7):** Initial application skeleton and navigational routes created.
* **Single-page app deployed to Vercel:** The application is live at `https://diet-tracker-xi.vercel.app/`.
* **Local persistence using localStorage (AppStateContext):** Full single-user state persistence implemented using browser storage.
* **Responsive layout & UI scaffolding:** Centralized layout component, consistent grid/card pattern, and a mobile-friendly sidebar toggle (hamburger + compact icon bar with dimming overlay) are complete.

### Core Pages Implemented
* Dashboard
* Day Log (meal entry UI)
* Foods (foods DB, search, add)
* Trends (charts)
* Settings

### Foods Database & Management
* **Foods database (central hub) implemented:** Functionality includes adding and editing food entries.
* **Unit label support:** Calorie (kcal) information is tracked per defined unit.
* **Categories & filters:** Filtering by Home, Street, Cheat, Drinks, All, and later-added Packaged categories is supported.
* **Favorite/Quick-add support:** Users can mark foods for quick entry.

### Food Search & Entry Flow
* **Food autocomplete/search:** Autocomplete is functional on the Foods page and integrated directly into the Day Log for inline searching and selection.
* **"New food" flow:** Users can quickly add new items on the fly during their first entry.

### Day Log & Entry Functionality
* **Meal entries:** Users can add entries for lunch, dinner, and extras.
* **Quantity support:** Calculations use $\text{quantity} \times \frac{\text{kcal}}{\text{unit}} \rightarrow \text{totalKcal}$.
* **Edit / Delete existing meal entries:** Inline editing with cancel/restore functionality is implemented.
* **Quick-add favourite food buttons:** Dedicated buttons are available for speed.
* **Hydration & Notes:** Slider for water tracking and text notes per day are supported.

### Weight & Trends
* **Weight logging:** Manual weight entries with selectable dates are supported.
* **Trends & charts (recharts):** Visualizations include daily/weekly trends, a weight chart, and a chart comparing calories vs. the user's target.

### Dashboard & Metrics
* **Dashboard stats:** Displays today's summary, streaks, and all-time statistics (e.g., Net Deficit).
* **NetKcal rule implemented:** Calorie calculation follows the logic: $\text{netKcal} = \text{intake} - \text{TDEE} + \text{workoutBurn}$.

### Miscellaneous
* **Stability and bugfix cycles:** Addressed issues including empty screens, white-on-white dropdowns, and date selection problems.
* **Deployment status:** The application is deployed and tested across all pages and flows.

## v2: UI Revamp Edition

The full transformation of Diet-Tracker since the start of this redesign journey

### Goals of Revamp
* Establish a calm, sharp productivity UI (BlackLotus-style focus)
* Ensure mobile-first experience without sacrificing desktop power-user features
* Improve visual hierarchy and organization across screens
* Introduce richer interactivity while keeping performance crisp
* Add new advanced features like category management & table analytics

### Major System-wide Enhancements

#### Global Visual Upgrade
* Rebuilt global stylesheet using design tokens: `--bg, --surface, --text, --primary, --shadow-soft, --card-radius, etc.`
* Unified card layouts, typography, spacing scale
* Polished light-mode palette for readability & calm aesthetic
* Improved box-model, container-based grids + responsive breakpoints
* Fixed persistent layout bugs (black backgrounds, scroll lock issues)

#### Layout & Navigation Overhaul
* New sticky topbar with branding + info
* New responsive Sidebar Rail

**Mobile Interaction**
* Double-tap anywhere → Sidebar rail appears
* Tap outside → Collapse away
* No loss of screen access under rail

**Desktop Interaction**
* Sidebar rail becomes interactive navigation cards
* “Grow on hover” + smooth transitions

### Page-wise Improvements

#### Dashboard
* Refined stat cards with cleaner metric hierarchy
* Grid improvements for ultra-wide screens
* Better spacing + visual clarity in hero card & “trio” row
* Proper contrast + clickable affordances

#### Day Log
* Full mobile-interactive redesign
* Meals moved into top tab selector (Toggle Lunch ↔ Dinner ↔ Extras — only one displayed at a time)
* Stacked hero stat editing cards
* Improved table readability → smaller food column + text wrapping to prevent overflow
* Subtle alternating row stripes
* Clear kcal total per selected meal tab
* Strong accessibility for thumb-zone interaction

#### Foods Database — The Biggest Functional Upgrade
**Category System 2.0 (now fully editable)**
* Virtual filters: All & Unassigned (Null)
* Add new category
* Rename category (all foods update automatically)
* Delete category → foods move to Unassigned
* Unassigned pill shows badge count
* Modal management UI with inline rename/delete

**Plus:**
* Search 🔍
* Favorites ⭐
* Inline editing
* Robust tablet + desktop layout
* Opportunity for future per-category colors 🎨

#### Stats — Mission Impossible → Complete
We achieved the dream:
* Horizontal scroll matrix of dates
* Left frozen column (metrics)
* Sortable analytics:
  * Tap any metric → sort Descending
  * Tap again → sort Ascending
  * Tap different metric → Reset
* Works perfectly on mobile, touch scroll →
* No scroll-lock or layout snap issues
* Clean alignment, compressed breakpoint sizing
* Perfect parity with desktop table

This required deep container debugging + layout restructuring — our proudest technical win.

#### Trends
* New combined chart layout:
  * Line chart: Intake vs TDEE
  * Mini stacked bars below: Meal composition (Lunch, Dinner, Extras)
* Independent 7D / 30D / All-time toggles per chart
* Weight chart fixes for value range visibility
* Better marker + tooltip formatting
* Modern minimal look

#### Settings Page Polish
* Section cards restyled to match theme
* Clean form layout & button hierarchy
* Page heading icon + consistent typography

### Behind-the-Scenes Improvements
* Extracted layouts / containers for consistency
* Fixed deep-rooted overflow logic conflicts
* Refined mobile breakpoints (480px, 640px, 900px tiers)
* Re-audited CSS to reduce duplication & ensure maintainability
* Component-level polish everywhere:
  * Search fields, icons
  * Buttons: hover/active states
  * Shadows, spacing, transitions

### Summary of Achievements

| Area          | Original                  | Now                                      |
|---------------|---------------------------|------------------------------------------|
| Mobile UX    | ❌ Struggling layouts     | ✔ Fully optimized + gestures             |
| Sidebar      | ❌ Always blocking        | ✔ Smart double-tap adaptive rail         |
| Stats        | ❌ Frozen, unreadable     | ✔ Best-in-class interactive table        |
| Foods        | ❌ Hardcoded categories   | ✔ Dynamic full CRUD for categories       |
| Trends       | ❌ Limited visuals        | ✔ Dual-chart insights + date controls    |
| Consistency  | ❌ Mixed styling          | ✔ Complete app-wide design language      |

## v3: Advanced TDEE Revamp Edition

The physiological recalibration of Diet-Tracker — transforming it from a simple calorie tracker into a precise energy modeler grounded in human physiology. This release is the technical cornerstone that elevates accuracy, transparency, and long-term reliability.

### Goals of Revamp
* Overhaul energy expenditure calculations to align with established physiological principles (BMR + NEAT + EAT + TEF = TDEE)
* Eliminate double-counting and heuristics in the legacy model while preserving all user data
* Introduce explicit, auditable components for NEAT, EAT, and derived Activity Factor
* Enable deeper insights through breakdowns and trends without disrupting existing workflows
* Lock in correctness with unit tests and backward compatibility

### Major System-wide Enhancements

#### Energy Model Overhaul
* **From Legacy to Physiology-Correct:** Replaced the old formula (TDEE = BMR × AF + Workout × Intensity) with a component-based system:
  - **Old Issues Addressed:** Eliminated workout double-counting, subjective intensity scaling, and opaque NEAT assumptions.
  - **New Formula:** BMR + NEAT (steps + survey) + EAT (net activities) = Maintenance + TEF (intake-based) = TDEE.
* **Canonical Pipeline:** Introduced `getDayDerived(state, dateKey)` as the single source of truth for all TDEE computations — consumed uniformly across Dashboard, Day Log, Stats, and Trends.
* **Profile Calibration:** New tunable constants (e.g., STEP_KCAL_CONST, WALK_KCAL_PER_KG_PER_KM) with safe fallbacks; legacy helpers wrapped for compatibility.

#### Core Energy Components
* **BMR (Basal Metabolic Rate):** Authoritative baseline, snapshotted per day (`bmrSnapshot`) to prevent retroactive changes from profile updates.
* **NEAT (Non-Exercise Activity Thermogenesis):** Blended from steps (calibrated constant × weight) and survey (subjective + standing + commute adjustments); weighted 75/25 for steps-dominant realism.
* **EAT (Exercise Activity Thermogenesis):** Distance-based gross calories for walks/jogs, minus BMR share for true net; intensity-scaled with fallbacks to estimated distances.
* **TEF (Thermic Effect of Food):** Intake × ratio (default 10%); applied post-maintenance for precise TDEE.
* **Derived Activity Factor (AF):** Automatically computed (Maintenance / BMR) — trends for insight, not manual input.

#### Activity Modes
* **Tiered Progression:** Days auto-upgrade: Manual (legacy AF), Advanced NEAT (steps + survey), Advanced Full (NEAT + EAT).
* **Seamless Integration:** Mode inferred from data presence; no user-facing toggles needed.

### Page-wise Improvements

#### New Activity Tab
* **Dedicated Energy Logging:** Central hub for walks/jogs (distance + intensity), steps, and NEAT survey (subjective scale, standing hours, active commute).
* **Live Previews:** Real-time NEAT kcal, EAT net/gross breakdowns, and computed AF — with totals updating on input.
* **Smart UX:** Add buttons for common activities; info banners explain NEAT vs. EAT; save triggers mode upgrade.

#### Day Log
* **TDEE Breakdown Display:** Full component visualization (BMR, NEAT, EAT net, TEF, Total TDEE) in a clean, stacked format.
* **Legacy Handling:** Old workout fields shown as display-only; manual AF inputs disabled in advanced modes.
* **Enhanced Feedback:** Deficit/surplus recalculates dynamically; hydration and notes unchanged.

#### Stats & Analytics
* **Decomposition Over Time:** New TDEE breakdown charts showing NEAT/EAT/TEF trends.
* **AF Trends:** Derived AF plotted for movement patterns (no storage, pure computation).
* **Daily Matrix Refinement:** Powered by canonical derivations; sortable columns now include NEAT and EAT nets.
* **Modular Components:** TDEEDecomposition and DailyStatsMatrix extracted for reusability.

#### Dashboard & Trends
* **Dynamic Metrics:** All stats (deficit, streaks) reference true TDEE; historical recalcs automatic but non-destructive.
* **Trends Updates:** Intake vs. TDEE lines now use advanced model; meal bars unchanged for continuity.
* **Streak Logic:** Refined to use net deficit from new TDEE (positive = under maintenance).

#### Settings
* **Profile Extensions:** New constants section (toggleable) for WALK/RUN/STEP/TEF tuning.
* **Migration Safeguards:** Import/export logic backfills `bmrSnapshot` and clears legacy workouts.

### Behind-the-Scenes Improvements
* **Modular Math Library (calculations.js):** Rewritten as pure functions (NEAT, EAT, AF, TEF); legacy wrappers ensure zero breakage.
* **Data Safety:** Explicit exclusions for old fields; snapshotted BMR prevents historical drift.
* **Unit Tests:** Comprehensive suite validates edge cases (null profiles, zero inputs); caught/fixed real bugs like NEAT blending.
* **Performance:** Memoized derivations in components; no regressions in render speed.

### Summary of Achievements

| Area              | Original (v1/v2)                  | Now (v3)                                      |
|-------------------|-----------------------------------|-----------------------------------------------|
| Energy Model     | Heuristic TDEE + workouts        | Physiology-correct: BMR + NEAT + EAT + TEF    |
| Calculation Site | Scattered per-page               | Centralized `getDayDerived` pipeline          |
| Activity Logging | Basic workouts                   | Explicit NEAT/EAT tab with live previews      |
| Data Integrity   | Risk of retroactive changes      | Snapshotted BMR; legacy display-only          |
| Insights         | Opaque trends                    | Auditable breakdowns + derived AF trends      |
| Reliability      | Untested math                    | Unit-tested core; migration-proof             |