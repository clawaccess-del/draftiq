# DraftIQ — Fantasy Football Draft Co-Pilot MVP

DraftIQ is a live fantasy football draft assistant web application designed to help managers make data-driven, context-aware picks in real-time. Instead of presenting static rankings, DraftIQ "reads the room" by analyzing league scoring settings, roster needs, positional scarcity, and opponent draft targets to recommend the optimal pick.

## 🚀 Live Deployment & Code

- **Production App**: [https://draftiq-two.vercel.app](https://draftiq-two.vercel.app)
- **GitHub Repository**: [https://github.com/clawaccess-del/draftiq](https://github.com/clawaccess-del/draftiq)
- **Vercel Project Dashboard**: [https://vercel.com/clawaccess-5765s-projects/draftiq](https://vercel.com/clawaccess-5765s-projects/draftiq)

---

## 🛠️ Tech Stack

- **Frontend/Backend**: Next.js 15+ (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, Lucide Icons
- **Database ORM**: Prisma Client (v6.x)
- **Authentication**: Auth.js (NextAuth.js) with credential mock/database fallbacks
- **Hosting**: Vercel

---

## ⚙️ Local Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/clawaccess-del/draftiq.git
   cd draftiq
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   *Note: If you leave `DATABASE_URL` empty, the app automatically runs in **Offline Sandbox Mode** storing all setup parameters and draft board picks inside browser `localStorage`.*

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Initialize Database** (Optional — if `DATABASE_URL` is set in `.env`):
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Start Local Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 📦 Database Schema

Our relational database tables are defined in [schema.prisma](prisma/schema.prisma):
- **users**: Accounts storing emails, names, and links to leagues.
- **leagues**: Stores league rules, scoring types (PPR/Half/Standard), size, and roster settings.
- **teams**: Keeps track of names, owners, draft slots, and is_user flags.
- **drafts**: Holds draft statuses, total rounds, styles (snake/linear), and pick pointers.
- **draft_picks**: Logs draft picks, pick rounds, player selections, and teams.
- **players**: Index of nfl players, positions, team names, and bye weeks.
- **player_rankings**: Import metrics (overall rankings, position ranks, ADP, risk, tier, projected points).
- **rosters**: Connects league team slots to drafted players (mapped as starting positions or bench).
- **recommendations**: Logs score breakdowns, probability rates, and co-pilot explanations.

---

## 📊 How the Recommendation Engine Works

Recommendations are driven by a deterministic, weighted scoring algorithm. Each available player is scored based on:

$$\text{Total Score} = \text{Projected Pts (30\%)} + \text{VORP (25\%)} + \text{Positional Need (20\%)} + \text{Tier Scarcity (10\%)} + \text{Opponent Pressure (8\%)} + \text{ADP Value (4\%)} + \text{Bye Fit (2\%)} + \text{Risk Adjustment (1\%)}$$

1. **Projected Value**: Normalizes projected points against the maximum projected player.
2. **Value Over Replacement (VORP)**: Evaluates points above the baseline replacement player at the position (tailored dynamically to league size and starters).
3. **Positional Need**: Penalizes positions already filled and boosts open starter slots (decreases as depth increases).
4. **Tier Scarcity**: Boosts players when they are the last remaining options in a high-tier class.
5. **Opponent Pressure & Survival Probability**: Counts teams drafting before the user's next turn, evaluates their positional needs, and estimates the chance the player makes it back.
6. **Watchlist & Avoid Lists**: Adding a player to your Watchlist grants a $+15$ point boost. Placing them on the Avoid List triggers a $-90$ point penalty.

---

## 🏈 User Draft Flow

1. **Log In**: Input any test email to authenticate (NextAuth mock handler active).
2. **League Setup**: Enter league name, size (e.g., 10 or 12 teams), scoring style, and define roster spot quotas. Input team names matching their draft positions.
3. **Upload CSV**: Upload player rankings (you can download our CSV template on the import page).
4. **Draft Room**: Track live board picks. Click **Draft** on the available table to log picks. The co-pilot recalculates optimal picks and survival rates instantly. Use the **Undo** button to roll back mistakes.
5. **Report Card**: Once all slots are filled, view your draft grade, core pillars, steals, risks, and waiver suggestions.

---

## 🧪 Testing Instructions

Run the next build to verify compiler health:
```bash
npm run build
```

---

## 🚧 Known Limitations & Roadmap

- **Live platform syncs**: Active sync is currently simulated by the Manual adapter interface.
- **Yahoo & Fleaflicker**: Stubs are created in `src/lib/integrations/` preparing the OAuth flow.
- **Dynamic Clock**: Manual pick logging updates the board immediately; automatic timing clocks will be added in Phase 2.
