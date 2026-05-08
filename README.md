<div align="center">

# RESILIENCE  
### AI-Driven Physical and Mental Fitness Social Platform

<img 
  src="https://github.com/user-attachments/assets/2c6f06e0-d3f4-4511-81bc-78866040a460"
  alt="Resilience Banner"
  width="450"
/>

<br><br>

<img src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
<img src="https://img.shields.io/badge/Database-PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white" />
<img src="https://img.shields.io/badge/AI-NLP%20Powered-8A2BE2?style=for-the-badge" />

<br><br>

<p>
  <b>Emotion Detection</b> •
  <b>Toxicity Analysis</b> •
  <b>Workout Detection</b> •
  <b>Real-Time Chat</b> •
  <b>AI Text Detoxification</b>
</p>

</div>

---

# Features

### Social Networking
- Create posts, comments, and reactions
- Social Feed (Posts, Comments, Likes)
- Send and manage friend requests  
- Real-time chat between users
- Mentorship Request System

### AI & NLP Capabilities
- Toxicity Detection – identifies harmful content  
- Text Detoxification – rewrites unsafe text  
- Emotion Detection – classifies emotions from text  
- Workout Detection – extracts structured workout info from posts  

### Analytics Dashboard
- Emotion timelines and trends  
- Toxicity tracking  
- Correlation analysis (emotion ↔ toxicity)  
- Emotion distribution insights  

### Real-Time System
- Live notifications (likes, comments, messages, requests)  
- WebSocket-based chat  

---
# AI / Machine Learning Components

<div align="center">

| Feature | Model Used |
|--------|----------|
| Emotion Detection | `SamLowe/roberta-base-go_emotions` |
| Toxicity Detection | `unitary/unbiased-toxic-roberta` |
| Text Detoxification | `s-nlp/bart-base-detox` |

</div>

---

# Tech Stack

**Frontend**
- React (Vite)
- Custom CSS

**Backend**
- FastAPI (Python)
- SQLAlchemy
- Alembic (Migrations)

**Database**
- PostgreSQL

**AI / NLP**
- Hugging Face Transformers  
- `SamLowe/roberta-base-go_emotions` (Emotion Detection)  
- `s-nlp/bart-base-detox` (Text Detoxification)

**Other**
- Recharts (Charts & Visualization)
- Docker

---

# Installation Guide

### 1. Clone Repository

```
git clone https://github.com/Keneth-Ravindu/resilience.git
cd resilience
```

### 2. Backend Setup

```
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

```
uvicorn app.main:app --reload 
```



### 3. NLP Service

```
cd nlp_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

```
uvicorn app.main:app --reload --port 8001
```

### 4. Rewrite Service

```
cd rewrite_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

```
uvicorn app.main:app --reload --port 8002
```

### 3. Database Configuration

PostgreSQL Setup (Local)
- Install PostgreSQL
- Create database:

```
CREATE DATABASE resilience_db;
```

- Update backend ```.env```
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/resilience_db
```

### 4. Frontend Setup

```
cd frontend
npm install
npm run dev
```

### 5. Docker Setup

- Install Docker Desktop
- Create ```.env``` file

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=resilience_db
POSTGRES_PORT=5432
```

```
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=admin
PGADMIN_PORT=5050
```

- Run System with Docker

```
docker-compose up --build
```

- Stop Containers
```
docker-compose down
```

- Reset Database
```
docker-compose down -v
docker-compose up --build
```

## Docker Services
<div align="center">

| Service | URL |
|--------|----------|
| PostgreSQL | `localhost:5432` |
| pgAdmin | `http://localhost:5050` |
| Rewrite Service | `http://localhost:8002` |

</div>

---

# API Overview

## Docker Services
<div align="center">

| Endpoint | Description |
|--------|----------|
| ```/auth``` | `localhost:5432` |
| ```/posts``` | `http://localhost:5050` |
| Rewrite Service | `http://localhost:8002` |

</div>
