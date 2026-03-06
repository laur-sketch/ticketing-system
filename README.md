# TicketFlow — Concern & Issue Ticketing System

A professional, role-based issue/concern ticketing system with a **React.js** frontend and **Python Flask** REST API backend, featuring real-time updates, live chat, notifications, and exportable analytics reports.

---

## Tech Stack

| Layer       | Technology                                                   |
|-------------|--------------------------------------------------------------|
| Frontend    | React 18, React Router v6, Tailwind CSS, Vite                |
| Backend     | Python Flask, Flask-SQLAlchemy, Flask-Login, Flask-SocketIO  |
| Real-time   | Socket.IO (WebSockets)                                       |
| Database    | **PostgreSQL** (via psycopg2-binary + SQLAlchemy)            |

---

## Prerequisites

- **Python 3.9+**
- **Node.js 18+** — https://nodejs.org (LTS version)
- **PostgreSQL 13+** — https://www.postgresql.org/download/

---

## Database Setup (PostgreSQL)

### Option A — pgAdmin (GUI)

1. Open **pgAdmin** → Servers → right-click → **Create › Database**
2. Name it `ticketflow`, click **Save**

### Option B — psql CLI

```bash
psql -U postgres
CREATE DATABASE ticketflow;
\q
```

### Configure the connection

```bash
# Copy the example env file
cp .env.example .env
```

Open `.env` and set your credentials:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/ticketflow
SECRET_KEY=any-long-random-string
```

> Tables are **created automatically** on first run via `db.create_all()`.  
> No manual migrations are needed for a fresh install.

---

## Setup & Run

### 1 — Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2 — Start the Flask backend (Terminal 1)

```bash
python app.py
```

> Runs on **http://localhost:5000**  
> On first start, all tables are created in the `ticketflow` database automatically.

### 3 — Start the React frontend (Terminal 2)

```bash
cd frontend
npm install      # first time only
npm run dev
```

> Runs on **http://localhost:5173**

Open **http://localhost:5173** in your browser.

> **The first registered account automatically becomes the Administrator.**

---

## Migrating from SQLite (existing data)

If you have existing data in `tickets.db` and want to move it to PostgreSQL:

1. Install `pgloader` — https://pgloader.io  
2. Run:

```bash
pgloader sqlite:///tickets.db postgresql://postgres:PASSWORD@localhost:5432/ticketflow
```

3. Update `.env` with your PostgreSQL `DATABASE_URL` and restart Flask.

---

## Roles & Permissions

| Role         | What they can do |
|--------------|------------------|
| **User**        | Submit tickets · comment · delete own Open/In-Progress tickets · view own ticket history |
| **IT Personnel** | All User actions + claim unassigned tickets + update ticket status + assigned queue |
| **Admin**       | All IT Personnel actions + manage users + reset passwords + archive tickets + view reports |

---

## Sample Workflow — End to End

### Step 1 — Register accounts

1. Open http://localhost:5173/register
2. Register the **first account** (becomes Admin automatically)
3. Register a second account and choose role **IT Personnel**
4. Register a third account and choose role **User**

### Step 2 — User submits a ticket

1. Log in as **User**
2. Click **New Ticket** in the sidebar
3. Fill in:
   - **Title**: "Printer not working on 3rd floor"
   - **Category**: Support
   - **Priority**: High
   - **Description**: detailed description
   - **Assign to IT Personnel**: select the IT Personnel account
4. Click **Submit**

### Step 3 — IT Personnel resolves the ticket

1. Log in as **IT Personnel**
2. Go to **My Queue** — the ticket appears there
3. Open the ticket → add a comment explaining the fix
4. Change **Status** → **Resolved**
5. The Admin receives an automatic notification: *"it_support resolved ticket TKT-00001"*

### Step 4 — Admin reviews and archives

1. Log in as **Admin**
2. Open the **Notification bell** → see the resolution notification
3. Go to **All Tickets** → select the resolved ticket → click **Archive**
4. The ticket moves to the **Archive** tab (read-only)

### Step 5 — Admin generates a Report

1. Go to **Reports** (Admin sidebar)
2. The report loads data from the same dataset as **All Tickets**
3. Select a **Month** from the dropdown (e.g., *March 2026*) to filter by period
4. Toggle **By Week / By Month** to change the timeline grouping
5. Review the charts:
   - **Tickets by Status** — see how many are Open, In Progress, Resolved, Closed
   - **Tickets by Category** — see which categories are most common
   - **Tickets by Priority** — Critical / High / Medium / Low breakdown
   - **Resolved by Personnel** — who resolved the most tickets
   - **Tickets per Week / Month** — volume over time
6. Click **Export Summary** → downloads an aggregated CSV
7. Click **Export CSV** → downloads every ticket row with full details

---

## Feature Overview

### Ticket Management
- Create, view, edit, delete (soft-delete) tickets
- Statuses: Open → In Progress → Under Review → Resolved → Closed
- Priority levels: Low · Medium · High · Critical
- Category tagging
- Assign to IT Personnel
- Real-time comment thread on every ticket

### Notifications (real-time)
- **Assignment notification** — sent to assigned personnel when a ticket is assigned
- **Resolution notification** — sent to all Admins when a ticket is marked Resolved
- Notification bell in the topbar with unread badge
- Timestamps reflect your chosen 12H / 24H clock format

### Live Chat (Direct Messages)
- Standalone DM system separate from tickets
- Start conversations with any user, IT Personnel, or Admin
- Add members to existing conversations
- Real-time message delivery via WebSocket
- Accessible from the chat bubble icon in the topbar

### Archive System
- Tickets auto-archive when status reaches **Closed**
- Admins can manually archive **Resolved / Closed** tickets individually or in bulk
- Archived tickets are read-only (no edits, comments, or status changes)
- Admins can restore any archived ticket

### Reports (Admin only)
- Data source mirrors the **All Tickets** tab
- Filter by any month using the month picker
- Toggle weekly or monthly timeline view
- **Breakdowns**: by Status · by Category · by Priority · Resolved by Personnel
- **Export Summary CSV** — aggregated breakdown table
- **Export Tickets CSV** — full per-ticket records with timestamps

### User Management (Admin only)
- View all registered users with role and status
- Activate / Deactivate accounts
- Reset password to default (`123456`)
- Change user roles

### Clock & Time Format
- Real-time analog + digital clock on the login page
- Toggle **12H / 24H** format — applies globally across all timestamps (notifications, chat, reports, ticket details, activity log)
- Format preference is saved to browser storage

---

## Project Structure

```
ticket_system/
├── app.py                   ← Flask REST API + Socket.IO events
├── requirements.txt
├── tickets.db               ← SQLite database (auto-created)
├── README.md
└── frontend/
    ├── package.json
    ├── vite.config.js       ← Proxies /api → Flask :5000
    └── src/
        ├── App.jsx                  ← Router + protected routes
        ├── api/client.js            ← Fetch wrapper
        ├── context/
        │   ├── AuthContext.jsx
        │   ├── ToastContext.jsx
        │   ├── SocketContext.jsx    ← Socket.IO client
        │   └── TimeFormatContext.jsx ← Global 12H/24H preference
        ├── hooks/
        │   ├── useNotifications.js
        │   └── useIdleLogout.js
        ├── components/
        │   ├── Layout.jsx           ← App shell (topbar + sidebar)
        │   ├── Sidebar.jsx
        │   ├── NotificationPanel.jsx
        │   ├── RecentChatsPanel.jsx ← Direct message system
        │   ├── Badge.jsx
        │   ├── Spinner.jsx
        │   ├── Pagination.jsx
        │   └── ConfirmModal.jsx
        └── pages/
            ├── Login.jsx            ← With real-time clock
            ├── Register.jsx
            ├── Dashboard.jsx
            ├── Profile.jsx
            ├── tickets/
            │   ├── TicketList.jsx   ← All Tickets (with bulk actions)
            │   ├── MyTickets.jsx
            │   ├── CreateTicket.jsx
            │   ├── TicketDetail.jsx ← Comments + activity log
            │   └── EditTicket.jsx
            ├── it_support/
            │   ├── Queue.jsx
            │   └── Unassigned.jsx
            └── admin/
                ├── Users.jsx
                ├── Archive.jsx
                └── Reports.jsx      ← Analytics + CSV export
```

---

## Key API Endpoints

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/register` | Public | Register (first = Admin) |
| GET | `/api/dashboard` | Any | Dashboard metrics |
| GET | `/api/tickets` | Any | List / filter tickets |
| POST | `/api/tickets` | Any | Create ticket |
| GET | `/api/tickets/:id` | Any | Ticket detail + comments |
| PUT | `/api/tickets/:id` | Owner/Admin | Update ticket |
| DELETE | `/api/tickets/:id` | Owner/Admin | Soft-delete ticket |
| POST | `/api/tickets/:id/comments` | Any | Add comment |
| PATCH | `/api/tickets/:id/status` | IT/Admin | Change status |
| POST | `/api/tickets/:id/claim` | IT/Admin | Claim ticket |
| POST | `/api/tickets/:id/archive` | Admin | Archive ticket |
| GET | `/api/tickets/:id/restore` | Admin | Restore archived ticket |
| GET | `/api/it-support/queue` | IT/Admin | Assigned queue |
| GET | `/api/it-support/unassigned` | IT/Admin | Unassigned tickets |
| GET | `/api/admin/users` | Admin | All users |
| PATCH | `/api/admin/users/:id/role` | Admin | Change role |
| PATCH | `/api/admin/users/:id/toggle` | Admin | Activate/Deactivate |
| POST | `/api/admin/users/:id/reset-password` | Admin | Reset to default password |
| GET | `/api/admin/archive` | Admin | Archived tickets |
| GET | `/api/reports/tickets` | Admin | Ticket analytics report |
| GET | `/api/notifications` | Any | User notifications |
| POST | `/api/notifications/:id/read` | Any | Mark notification read |
| GET | `/api/conversations` | Any | DM conversation list |
| POST | `/api/conversations` | Any | Start new conversation |
| GET | `/api/conversations/:id/messages` | Any | Conversation messages |
| POST | `/api/conversations/:id/members` | Any | Add member to conversation |
| GET | `/api/users/search` | Any | Search users (for chat/assign) |

---

## Default Credentials (after reset)

| Field    | Value   |
|----------|---------|
| Password | `123456` |

> Admins can reset any user's password to this default via **User Management → Reset Password**.
> Users should change their password after first login via **Profile**.

---

## Idle Auto-Logout

The system automatically logs out users after **2 minutes of inactivity** to protect sensitive data. A warning banner appears before logout giving users a chance to stay logged in.
#
