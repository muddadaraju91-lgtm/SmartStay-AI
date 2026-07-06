# SmartStay AI – Intelligent Student Accommodation Platform

SmartStay AI is a production-ready, three-sided accommodation marketplace built using React, Node.js, Express, and MySQL. It helps university students find verified hostels near campuses, checks real-time vacancy slots, blocks double-bookings under high concurrency, handles payments, and provides smart recommendations.

---

## 📂 GitHub Repository Structure

```text
smartstay-ai/
├── backend/                  # Node/Express API Server
│   ├── config/               # Database Pool & Cloudinary Configs
│   │   ├── db.js
│   │   └── cloudinary.js
│   ├── controllers/          # API Controllers
│   ├── middleware/           # Security, Auth, and File Upload Guards
│   │   ├── authMiddleware.js
│   │   ├── errorMiddleware.js
│   │   └── uploadMiddleware.js
│   ├── routes/               # Express Routes Mappings
│   ├── services/             # Analytics, Trust & Recommendation Engines
│   ├── database/             # Relational Database Schema DDLs
│   ├── .env.example          # Environment Secrets Template
│   └── server.js             # Root Application Hook
│
├── frontend/                 # Vite/React Single Page Application
│   ├── src/
│   │   ├── components/       # Header / Footer Components
│   │   ├── context/          # React Auth State Context
│   │   ├── pages/            # Student, Owner, and Admin Views
│   │   ├── services/         # API HTTP Client Mappings
│   │   └── App.jsx           # Routes and Route Guards
│   ├── .env.example          # Client Variables Template
│   └── vercel.json           # Vercel SPA Routing Configuration
│
├── .gitignore                # Global Git Filtering Configuration
├── render.yaml               # Render IaC Blueprint Configuration
└── README.md                 # Project Setup & Documentation
```

---

## 🛠️ Local Installation & Execution

### 1. Database Setup
1. Log in to your local MySQL console (e.g. XAMPP CLI or MySQL Server).
2. Create the platform database:
   ```sql
   CREATE DATABASE smartstay_db;
   ```
3. Import the tables:
   ```bash
   mysql -u root -p smartstay_db < backend/database/schema.sql
   ```

### 2. Backend Initialization
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Copy the environment variables:
   ```bash
   cp .env.example .env
   ```
3. Fill in the values in your new `.env` file (MySQL credentials, JWT secret, Cloudinary, and Razorpay API tokens).
4. Install dependencies:
   ```bash
   npm install
   ```
5. Run the dev server locally:
   ```bash
   npm run dev
   ```

### 3. Frontend Initialization
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Copy the environment variables:
   ```bash
   cp .env.example .env
   ```
3. Verify that `VITE_API_URL` points to your backend instance (`http://localhost:5000/api`).
4. Install dependencies:
   ```bash
   npm install
   ```
5. Run the Vite client:
   ```bash
   npm run dev
   ```
6. Access the client portal at `http://localhost:5173`.

---

## 📦 Git & GitHub Setup Commands

To push this codebase to your personal GitHub repository for recruiter showcases, execute the following commands in the workspace root:

```bash
# Initialize Local Repository
git init

# Track All Project Files (Omitted secrets via .gitignore)
git add .

# Save Initial Snapshot
git commit -m "feat: init SmartStay AI project structure with concurrency-safe booking engine"

# Link Personal GitHub Repository (Replace URL with your repo details)
git remote add origin https://github.com/your-username/smartstay-ai.git

# Set Default Branch
git branch -M main

# Push Codebase
git push -u origin main
```

---

## 🚀 Deployment Playbook

### Frontend Deployment (Vercel)
1. Install the Vercel CLI locally:
   ```bash
   npm install -g vercel
   ```
2. Navigate to the `frontend/` directory and run deployment:
   ```bash
   cd frontend
   vercel
   ```
3. Follow the CLI wizard prompts. Set your framework preset to **Vite** and output directory to **dist**.
4. Configure production environment variables inside the Vercel Dashboard:
   *   `VITE_API_URL`: *Your Render backend URL endpoint*

### Backend Deployment (Render)
1. Create a free account on [Render](https://render.com).
2. Connect your GitHub repository to Render.
3. Deploy using the Infrastructure-as-code **Render Blueprint** option:
   *   Render will read your [render.yaml](file:///c:/Users/mudda/OneDrive/Desktop/my%20website/render.yaml) file, set up the web services, and configure environment hooks.
4. Input your database host details, Cloudinary buckets keys, and Razorpay API secrets inside the Render variables settings panel.

---

## 🔒 Security Best Practices for API Keys

When deploying production-grade systems, protecting API credentials is paramount. Follow these senior-engineer-level protocols:

1.  **Strict Environment Isolation:** Never commit `.env` files to git. Verify that your [.gitignore](file:///c:/Users/mudda/OneDrive/Desktop/my%20website/.gitignore) contains active blocks for `*.env`.
2.  **No Client Exposure of Secrets:** Secrets like `RAZORPAY_KEY_SECRET` and `CLOUDINARY_API_SECRET` must remain exclusively on the backend. Only public keys (like `RAZORPAY_KEY_ID`) can be passed to the frontend.
3.  **Strict Origin Restrictions (CORS):** Limit cross-origin requests on your backend server by checking that `CORS_ORIGIN` matches only your production Vercel client URL.
4.  **Key Rotation:** Always rotate database passwords and API tokens if a developer accidentally logs them in diagnostic outputs.
