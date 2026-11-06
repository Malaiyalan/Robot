# Robot App – Python (FastAPI) + PostgreSQL + React Native (Expo)

A full-stack robotics companion application with a **FastAPI** backend, **PostgreSQL** database, and **React Native (Expo)** cross-platform mobile frontend.

---

## Project Structure

```
robot-app/
├── backend/
│   ├── run.py              # ▶ Start API server (python run.py)
│   ├── migrate.py          # ▶ Apply database migrations
│   ├── check_db.py         # ▶ Verify PostgreSQL connection
│   ├── .env                # Backend environment credentials
│   ├── .env.example        # Environment template
│   ├── requirements.txt    # Python dependencies
│   ├── alembic/            # Database schema migrations
│   └── app/                # Application code (models, schemas, routers, services)
└── frontend/
    └── mobile/             # React Native Expo mobile application
        ├── App.js          # App entry point
        ├── .env            # Mobile environment config (API URL)
        ├── package.json
        └── src/
            ├── config.js   # API endpoint configuration
            ├── screens/    # UI screens (Devices, etc.)
            └── services/   # HTTP API clients
```

---

## Prerequisites

| Software | Version | Purpose |
|:---|:---|:---|
| **Python** | 3.10 – 3.14 | Backend API |
| **PostgreSQL** | 14+ | Relational Database |
| **Node.js & npm** | 18+ or 20+ LTS | Mobile app tooling |
| **Expo Go** *(optional)* | Latest | Free mobile app on Google Play / App Store |

---

## 1. Database Setup (One-time)

Make sure your PostgreSQL server is running. Create the user and database:

### **Windows (psql command line)**
```sql
-- Connect via psql: psql -U postgres
CREATE USER postgres WITH PASSWORD 'YourPassword123';
CREATE DATABASE robot_app OWNER postgres;
GRANT ALL ON SCHEMA public TO postgres;
```

### **Ubuntu / Linux**
```bash
sudo systemctl enable --now postgresql
sudo -u postgres psql
```
```sql
CREATE USER robot_user WITH PASSWORD 'StrongPass123';
CREATE DATABASE robot_app OWNER robot_user;
\c robot_app
GRANT ALL ON SCHEMA public TO robot_user;
\q
```

---

## 2. Backend Setup & Run

### Step 1: Configure `.env`
In `backend/.env`:
```env
PORT=8000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=YourPassword123
DB_NAME=robot_app
```

---

### Step 2: Install dependencies, migrate, and start server

#### **On Windows (PowerShell):**

```powershell
# 1. Navigate to backend
cd backend

# 2. Create virtual environment (first time only)
python -m venv .venv

# 3. Activate virtual environment
.\.venv\Scripts\Activate.ps1
# (Note: If you get an execution policy error, run:
#  Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned)

# 4. Install dependencies
pip install -r requirements.txt

# 5. Verify database connection
python check_db.py
# Expect: ✅ Connected: PostgreSQL ...

# 6. Run database migrations (creates tables)
python migrate.py
# Expect: ✅ Migration complete.

# 7. Start the backend server
python run.py
```

> **Windows Shortcut (run without activating venv):**
> ```powershell
> cd backend
> .\.venv\Scripts\python.exe run.py
> ```

---

#### **On Ubuntu / Linux / macOS:**

```bash
# 1. Navigate to backend
cd backend

# 2. Create virtual environment (first time only)
python3 -m venv .venv

# 3. Activate virtual environment
source .venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Verify database connection
python check_db.py

# 6. Run migrations
python migrate.py

# 7. Start the backend server
python run.py
```

---

### Verify Backend is Working:
- **Swagger Interactive API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check Endpoint**: [http://localhost:8000/health](http://localhost:8000/health) → `{"status":"ok","database":"connected"}`

---

## 3. Mobile App Setup & Run (Expo)

### Step 1: Configure Mobile `.env`
Open `frontend/mobile/.env` and set `EXPO_PUBLIC_API_URL`:

| Target Platform | `EXPO_PUBLIC_API_URL` | How to find your IP |
|:---|:---|:---|
| **Physical Phone (Expo Go)** | `http://<YOUR_PC_IP>:8000` | Windows: `ipconfig`<br>Linux: `hostname -I` |
| **PC Web Browser** | `http://localhost:8000` | Default localhost |
| **Android Emulator** | `http://10.0.2.2:8000` | Android Studio default loopback |
| **iOS Simulator** | `http://localhost:8000` | macOS default |

*Example for physical phone on Wi-Fi:*
```env
EXPO_PUBLIC_API_URL=http://192.168.1.13:8000
```

---

### Step 2: Start Expo

Open a new terminal window:

```powershell
cd frontend/mobile
npx expo start -c
```

A QR code will be displayed in your terminal.

#### **Viewing the App:**
- **On a Physical Phone (Android / iPhone)**:
  1. Install the free **Expo Go** app from Google Play Store or Apple App Store.
  2. Make sure your phone and PC are connected to the **same Wi-Fi**.
  3. Scan the QR code using Expo Go (Android) or Camera app (iPhone).
  4. You will see **● Backend connected**.
- **In your Web Browser (no phone needed)**:
  - In the terminal where Expo is running, press **`w`**.
  - The app will automatically open at `http://localhost:8081`.

---

## API Summary (Prefix `/api/v1`)

| Resource | Endpoints | Description |
|:---|:---|:---|
| **Health** | `GET /health` | Check API and DB connectivity |
| **Users** | `GET/POST /users/`, `GET/PATCH/DELETE /users/{id}` | Manage user accounts |
| **Devices** | `GET/POST /devices/`, `GET/PATCH/DELETE /devices/{id}` | Manage robot devices & online status |
| **Activity Logs** | `GET/POST /activity-logs/`, `GET/PATCH/DELETE /activity-logs/{id}` | Audit events and actions |
| **Sarees** | `GET/POST /sarees/`, `GET/PATCH/DELETE /sarees/{id}` | Saree try-on catalog |
| **Photo Sessions**| `GET/POST /photo-sessions/` + `GET /photo-sessions/public/{token}` | QR code guest photo delivery |

---

## Database Migrations (Alembic)

When modifying or adding models in `backend/app/models/`:

```bash
cd backend
alembic revision --autogenerate -m "describe changes"
python migrate.py
```

---

## Troubleshooting Guide

| Error | Root Cause | Solution |
|:---|:---|:---|
| `'source' is not recognized` | Using Linux command on Windows PowerShell | Run `.\.venv\Scripts\Activate.ps1` or run directly with `.\.venv\Scripts\python.exe run.py`. |
| `'nano' is not recognized` | Using Linux text editor on Windows | Open file in VS Code or run `notepad .env`. |
| `Execution of scripts is disabled on this system` | PowerShell script policy restriction | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned`. |
| `No Android connected device found` | `npm run android` run without emulator/device | Run `npx expo start -c` instead and scan QR code with **Expo Go** or press `w` for web. |
| `password authentication failed` | `.env` password does not match PostgreSQL | Update `DB_PASSWORD` in `backend/.env`. |
| `Connect call failed ... 5432` | PostgreSQL service not running | Windows: Start service in Services (`postgresql-x64-*`).<br>Linux: `sudo systemctl start postgresql`. |
| `relation "..." already exists` | Tables were created outside of Alembic | Run `python migrate.py` after verifying migrations or stamping Alembic head (`alembic stamp head`). |
| Mobile says "Backend unreachable" | Phone cannot reach PC port 8000 | 1. Ensure phone and PC are on the same Wi-Fi.<br>2. Set correct PC IP in `frontend/mobile/.env`.<br>3. Allow port 8000 through Windows Firewall (`New-NetFirewallRule -DisplayName "FastAPI" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow`). |
