Halagel Manufacturing Production Dashboard
A role-based manufacturing production planning, tracking, and analytics web application built for Halagel manufacturing operations across Healthcare, Toothpaste, Rocksalt, and Cosmetic departments.
Key Features
Manufacturing Overview (/):
Department-filtered daily production view grouped by date (Malaysia Time, UTC+8).
Plan vs. Actual quantities, achievement efficiency (%), batch numbers, manpower tracking, and status indicators.
Excel-style corner remark popups (hover, pin, copy, or expand full planning & actual notes).
Automatic Friday (Off Day) and Saturday (Rest Day) indicators plus custom public holiday / off-day alerts.
Production Calendar (/calendar):
Process-by-date horizontal schedule matrix showing planned and completed runs per production stage.
Quick entry addition directly from calendar cells for authorized planning roles.
Production Reports (/reports):
Filterable production log by date range, department, process, status, and search keywords.
CSV export for reporting and record-keeping.
Process Analytics (/process-analytics):
Visual charts and KPI summaries comparing planned output, actual output, efficiency trends, and manpower across processes and departments.
Activity Logs (/logs):
Audit trail recording plan creation, actual production updates, deletions, holiday changes, and user management actions.
User Management (/users):
Admin-only directory for creating, updating, and removing user accounts and assigning roles.
Offline-First & Cloud Sync:
Works offline via browser localStorage and Progressive Web App (PWA) caching, and automatically synchronizes with a Google Sheets Apps Script backend when configured.
Dark Mode & Responsive UI:
Sticky desktop sidebar for fast department switching while scrolling, dark/light theme toggle, and mobile bottom navigation bar.
Departments & Production Processes
Departments: Healthcare, Toothpaste, Rocksalt, Cosmetic
Production Processes: Mixing, Encapsulation, Filling, Sorting, Packing, Blister, Capsules (filtered automatically per department)
Units Supported: KG, PCS, CARTON, BTL, BOX, PAX, TUBE, BLISTER, SET, POUCH
User Roles & Permissions
Role	View Dashboards & Reports	Create / Edit Plan Data	Record Actual Output	Manage Holidays / Off-Days	Manage Users
Admin	Yes	Yes	Yes	Yes	Yes
Planner	Yes	Yes	No	Yes	No
Manager	Yes	No	Yes	Yes	No
HOD	Yes	No	No (can edit/delete entries on dashboard)	No	No
Operator	Yes	No	Yes	No	No
Note: Contact your system administrator to obtain your login credentials. You can update your password anytime from the top header bar after signing in.
How to Use the Dashboard
Browse Production Data (No Login Required for Viewing):
Use the sticky left sidebar to switch between Dashboard, Production Calendar, Production Reports, and Process Analytics, or select a Department (Healthcare, Toothpaste, Rocksalt, Cosmetic).
Hover or click the colored corner triangles on Plan/Actual cells to inspect full remarks.
Sign In:
Click Login in the top-right header and enter your assigned username and password.
Create a Production Plan (Admin / Planner only):
Click New Entry in the sidebar (or navigate to /plan, or click + on a calendar cell).
Select the production date, department, process, product description, planned quantity, unit, and optional planning remarks.
Record Actual Production (Admin / Manager / Operator):
Open New Entry → Actual tab (or go to /actual), select the pending plan for the date/department, and enter actual quantity, batch number, manpower, and execution remarks.
Manage Holidays / Off-Days (Admin / Manager / Planner):
Click Holidays in the sidebar to add or remove public holidays and non-working days.
Sync Data:
Data syncs automatically in the background every 20 seconds and when returning to the browser tab. Click the Refresh / Sync icon in the header to trigger a manual sync anytime.
Tech Stack
Frontend: React 19, TypeScript, React Router (HashRouter), Tailwind CSS
Charts & Icons: Recharts, Lucide React
Build & PWA: Vite, vite-plugin-pwa
Backend Storage: Google Apps Script Web App (Google Sheets) + localStorage fallback
Local Development & Build
Prerequisites
Node.js 20+ and npm
Commands
Bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run TypeScript type check
npm run lint

# Build production bundle (outputs to dist/)
npm run build

# Preview production build locally
npm run preview
Google Sheets Sync Setup (Optional)
To connect the dashboard to your own Google Sheets backend:
Deploy a Google Apps Script Web App with access set to Anyone.
Set HARDCODED_URL in services/googleSheetsService.ts to your deployed Web App /exec URL.
Commit and push your changes — the header status badge will display Cloud DB Active when connected.
Deployment (GitHub Pages)
This repository includes .github/workflows/deploy.yml for automatic deployment to GitHub Pages whenever changes are pushed to the main branch (npm install && npm run build, publishing ./dist).
