# JobTrace — Your Job Search, Organized.

A full-stack job application tracker built with Node.js, Express, MongoDB, and vanilla JavaScript. Track every application, monitor your progress, and get AI-powered career advice — all in one place.

**Live Demo:** [jobtrace.netlify.app](https://jobtrace.netlify.app)

---

## Features

- **Application Tracking** — Add, edit, and delete job applications with company, title, status, date, and notes
- **Status Management** — Click any status badge to cycle through Applied → Interview → Offer → Rejected
- **Kanban Board** — Switch between list view and a Kanban board grouped by status
- **AI Career Advisor** — Multi-turn chat powered by Claude AI, personalized to your application stats
- **Stats Dashboard** — Animated counters for Total, Applied, Interviews, Offers, and Rejections
- **Pipeline Conversion** — Visual funnel showing your application → interview → offer rates
- **Activity Heatmap** — GitHub-style heatmap of your application activity over 16 weeks
- **Achievements** — 8 milestone badges that unlock as you progress (locked badges shown as motivation)
- **Inline Note Editing** — Click notes on any card to edit them directly
- **Undo Delete** — 5-second undo window when deleting an application
- **Skeleton Loading** — Shimmer placeholders while data loads
- **Onboarding Tour** — 3-step guided tour for first-time users
- **Keyboard Shortcuts** — `N` to add a job, `/` to focus search, `Esc` to close modals
- **Confetti** — Celebration animation when you receive an offer
- **Company Favicons** — Auto-fetched company logos on each job card
- **Fully Responsive** — Optimized for desktop and mobile

---

## Tech Stack

**Frontend**
- Vanilla HTML, CSS, JavaScript (no frameworks)
- Deployed on **Netlify**

**Backend**
- Node.js + Express
- MongoDB + Mongoose
- JWT Authentication (bcryptjs)
- Claude AI API (`claude-sonnet-4-6`) for the AI Advisor
- Deployed on **Render**

---

## Project Structure

```
JobTrace/
├── backend/
│   ├── config/
│   │   └── db.js               # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js   # Register, login, get user
│   │   └── jobController.js    # CRUD + stats + AI advice
│   ├── middleware/
│   │   └── authMiddleware.js   # JWT verification
│   ├── models/
│   │   ├── User.js             # User schema
│   │   └── Job.js              # Job application schema
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── jobRoutes.js
│   └── server.js               # Express app entry point
│
└── frontend/
    ├── index.html              # Sign in / Sign up page
    ├── dashboard.html          # Main dashboard
    ├── favicon.svg             # App favicon
    ├── css/
    │   └── style.css
    └── js/
        ├── api.js              # API request helpers
        └── app.js              # Dashboard logic
```

---

## Running Locally

### Prerequisites
- Node.js v18+
- MongoDB Atlas account (or local MongoDB)
- Anthropic API key

### Backend

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` folder:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
CLAUDE_API_KEY=your_anthropic_api_key
```

```bash
npm start
```

### Frontend

```bash
cd frontend
python3 -m http.server 5500
```

Then open [http://localhost:5500](http://localhost:5500).

> Make sure `frontend/js/api.js` has `API_BASE` pointing to `http://localhost:5000/api` when running locally.

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Create account | No |
| POST | `/api/auth/login` | Sign in | No |
| GET | `/api/auth/me` | Get current user | Yes |
| GET | `/api/jobs` | Get all jobs (filter/sort/search) | Yes |
| POST | `/api/jobs` | Create a job application | Yes |
| PUT | `/api/jobs/:id` | Update a job application | Yes |
| DELETE | `/api/jobs/:id` | Delete a job application | Yes |
| GET | `/api/jobs/stats` | Get status counts | Yes |
| POST | `/api/jobs/ai-advice` | Get AI career advice | Yes |

---

## Built By

**Ali AlShammari** — Built for the CODED Academy Internship Challenge, 2026.
