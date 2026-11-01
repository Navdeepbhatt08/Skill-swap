# SkillSwap

SkillSwap is a peer-to-peer student skill exchange platform built with React, Vite, Tailwind CSS, Express, and MongoDB.

## Backend structure

The backend uses MongoDB/Mongoose and is organized incrementally around:

- `backend/routes/` for authentication and skill API routes.
- `backend/middleware/` for authentication and database availability checks.
- `backend/utils/` for resource validation and public response serializers.
- `backend/models/` for Mongoose persistence models.
- `backend/index.js` for application startup, realtime chat, and the remaining API routes.

## Implemented API workflows

Protected APIs use `Authorization: Bearer <JWT>`.

- Authentication: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
- Skills: `/api/skills`
- Profiles and matching: `/api/users`, `/api/matches`, `/api/dashboard`
- Requests: `/api/requests`, `/api/requests/:id`
- Sessions: `/api/sessions`, `/api/sessions/:id`
- Reviews: `/api/reviews`, `/api/reviews/user/:userId`
- Chat: Socket.IO `chat:send` and `/api/messages/:userId`
- Resources: `POST /api/resources/upload` with multipart field `file` (maximum 10 MB)

## Testing the main workflows

1. Configure `MONGODB_URI` and `JWT_SECRET` in `backend/.env`.
2. Run `npm run dev`.
3. Register two users, add teaching and learning skills, and verify reciprocal matches on Discover.
4. Send a request, accept it from the second account, and verify Chat and Schedule become available.
5. Schedule, accept, complete, and review a session.
6. In Chat, use the attachment button to upload a file or share a link.
7. Refresh the browser and confirm the JWT session and database-backed data persist.

Validation commands:

```powershell
node --check backend\index.js
npm run build --prefix frontend
```

## Core product flows

- Discover peer-owned skills and send targeted learn or exchange requests.
- Accept a connection to unlock direct chat and contact details.
- Share resource links or upload files up to 10 MB directly in chat.
- Schedule, accept, complete, and review practical learning sessions.
- Build trust with one rating and optional written review per completed session.
- Manage teaching skills, learning goals, availability, and profile contact details.
- Monitor community activity through the admin summary dashboard.

---

## 🚀 Quick Deployment Guide

You can deploy SkillSwap using one of the following platform options:

### Option 1: Unified Single-Service Deployment (Recommended - Render / Railway / Heroku)

Deploy both the backend and frontend together from this repository as a single web service. Express serves the production React build from `frontend/dist` and handles `/api/*` endpoints.

1. **Push your repository** to GitHub.
2. **On [Render.com](https://render.com) (or Railway / Heroku)**:
   - Create a new **Web Service** and connect your GitHub repo.
   - **Build Command**: `npm run postinstall && npm run build`
   - **Start Command**: `npm start`
   - Add the following **Environment Variables**:
     - `NODE_ENV`: `production`
     - `MONGODB_URI`: Your MongoDB Atlas connection URI (`mongodb+srv://<user>:<password>@cluster.mongodb.net/skillswap?retryWrites=true&w=majority`)
     - `JWT_SECRET`: A long random secret key (e.g. 32+ characters)
     - `PORT`: Automatically set by the host (or default `5000`)
3. **Deploy**: Render will build the frontend, start the server, and serve your app.

*(A `render.yaml` blueprint is also included in this repository for 1-click Render blueprint deploys).*

---

### Option 2: Split Deployment (Frontend on Vercel / Netlify + Backend on Render / Railway)

#### Step 1: Deploy Backend (e.g., Render Web Service)
1. In Render, select **New Web Service** pointing to your repository.
2. Set **Root Directory** to `backend`.
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. Set Environment Variables:
   - `MONGODB_URI`: Your MongoDB Atlas URI.
   - `JWT_SECRET`: Your random secret key.
   - `CLIENT_URL`: URL of your deployed frontend (e.g., `https://skillswap.vercel.app`).
6. Copy your deployed backend URL (e.g., `https://skillswap-api.onrender.com`).

#### Step 2: Deploy Frontend (e.g., Vercel)
1. Import your GitHub repository into [Vercel](https://vercel.com).
2. Set **Root Directory** to `frontend` (or leave root since `vercel.json` is configured).
3. Set Environment Variable:
   - `VITE_API_URL`: Your deployed backend URL from Step 1 (e.g., `https://skillswap-api.onrender.com`).
4. Click **Deploy**. Vercel will build the frontend and route API requests to your live backend.

---

---

## 🔑 Environment Variables Reference

| Variable | Description | Where It's Used |
| :--- | :--- | :--- |
| `PORT` | Web server port (defaults to 5000) | Backend |
| `MONGODB_URI` | MongoDB connection string (Local or MongoDB Atlas) | Backend |
| `JWT_SECRET` | Secret key for signing authentication tokens | Backend |
| `CLIENT_URL` | Allowed frontend origin for CORS (comma-separated or empty for all) | Backend |
| `VITE_API_URL` | Base URL of backend API (leave empty for local Vite proxy) | Frontend |

### Database initialization and migrations

This project uses Mongoose schemas and does not currently have a separate
migration framework. On the first successful MongoDB connection, the backend's
idempotent `seedDatabase()` initializer creates the demo users and skills.
Starting the backend again does not duplicate those records. Future schema
changes should be handled with an explicit versioned migration before deploying
to an existing production volume.

---

## 👤 Preloaded Demo Accounts

When the database initializes with `MONGODB_URI`, it automatically seeds demo accounts:

- **Demo Student**: `navdeep9557@gmail.com` / Password: `12345678`
- **Demo Peer**: `aarav@skillswap.app` / Password: `demo1234`
- **Admin**: `admin@skillswap.app` / Password: `demo1234`
