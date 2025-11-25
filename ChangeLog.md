# Changelog

## Diet-Tracker — Progress Tally (since first public deployment)

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