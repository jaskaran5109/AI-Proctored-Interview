# AI Interview Assistant with Proctoring + Knowledge Authenticity - PRD

## Original Problem Statement
AI Interview Assistant with Proctoring + Knowledge Authenticity Analysis - A scalable interview platform where:
- Recruiters create interview sessions with topics, difficulty levels, and time limits
- Candidates receive unique session links via email
- AI (Claude) generates technical interview questions dynamically
- **NEW: Candidates have access to a side-by-side AI Chat Assistant for help**
- **NEW: System analyzes how candidates use AI to generate a "Knowledge Authenticity Score"**
- Real-time proctoring with face detection, tab switching detection
- Comprehensive reports for recruiters with authenticity insights

## User Personas
1. **Recruiter/HR Manager** - Creates interview sessions, reviews results with authenticity analysis
2. **Candidate** - Takes technical interviews with AI assistant access, proctoring tracked

## Core Requirements (Static)
- User authentication (JWT-based)
- Interview session CRUD
- AI-powered question generation
- AI-powered answer evaluation
- **AI Assistant Panel for candidates**
- **Knowledge Authenticity Analysis**
- Real-time proctoring (tab switch detection)
- Session results and reporting with authenticity metrics

## Tech Stack
- **Backend**: FastAPI + MongoDB
- **Frontend**: React 19 + Tailwind + Shadcn/UI
- **AI**: Claude Sonnet 4.5 via Emergent Integrations
- **State Management**: Zustand (including AI chat state)
- **Design**: Swiss Brutalist aesthetic

## What's Been Implemented (March 31, 2026)

### Backend v2.0 (100% Complete)
- [x] JWT Authentication (register, login, logout, refresh)
- [x] Brute force protection
- [x] Interview Session CRUD with authenticity fields
- [x] AI Question Generation (Claude integration)
- [x] AI Answer Evaluation with scoring
- [x] **AI Assistant Chat API (/api/assist/chat)** - NEW
- [x] **Chat History API (/api/assist/history)** - NEW
- [x] **Authenticity Analysis per answer** - NEW
- [x] **Query Intent Classification** - NEW (concept_clarification, approach_guidance, full_answer_request, debugging)
- [x] Dashboard stats with authenticity metrics
- [x] Admin seeding on startup

### Frontend v2.0 (95% Complete)
- [x] Login/Register pages (Swiss Brutalist design)
- [x] Recruiter Dashboard with authenticity stats and columns
- [x] Understanding Level breakdown (Independent/Guided/AI-Dependent)
- [x] Create Session wizard
- [x] Session details with **Knowledge Authenticity Analysis section**
- [x] Candidate Pre-check page with **AI Assistant notice**
- [x] Interview Room with **split-view layout**
- [x] **AIAssistantPanel component** - NEW (collapsible chat panel)
- [x] **AuthenticityIndicator component** - NEW
- [x] Real-time chat with quick prompts
- [x] Tab switch violation detection
- [x] Interview Results page

## New Database Collections
- `ai_assistance_logs` - Immutable chat log storage
  - session_id, question_id, user_query, ai_response, query_intent, latency_ms, created_at

## New Session Fields
- `authenticity_score` (Float 0-10)
- `ai_assistance_count` (Int)
- `understanding_level` (INDEPENDENT | GUIDED | AI_DEPENDENT)

## New Answer Fields
- `authenticity_score` (Float 0-10)
- `ai_assistance_used` (Boolean)
- `chat_log_count` (Int)
- `authenticity_analysis` (Object with justification, query_intents, concerning_patterns)

## P0 Features (Done)
- User authentication
- Session creation
- AI question generation
- Answer evaluation
- **AI Assistant Panel with chat**
- **Knowledge Authenticity Analysis**
- Basic proctoring (tab switch)

## P1 Features (Future)
- Face detection via face-api.js
- Speech-to-text input
- Email notifications (Resend integration)
- Snapshot capture and upload
- WebSocket real-time updates
- PDF report export

## P2 Features (Backlog)
- Video recording
- Multi-language support
- Custom question banks
- Team collaboration
- Advanced analytics dashboard

## API Endpoints v2.0

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new recruiter |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Get current user |

### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/sessions/create | Create interview session |
| GET | /api/sessions/list | List recruiter's sessions |
| GET | /api/sessions/{id} | Get session details |
| DELETE | /api/sessions/{id} | Delete session |

### Interviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/interviews/validate | Validate candidate access |
| POST | /api/interviews/start | Start interview |
| POST | /api/interviews/answer | Submit answer |
| GET | /api/interviews/result/{token} | Get results |

### AI Assistant (NEW)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/assist/chat | AI chat for candidates (rate limited) |
| GET | /api/assist/history/{token}/{question_id} | Get chat history |

### Proctoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/proctoring/violation | Report violation |

### Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/stats | Dashboard statistics with authenticity |

## Test Credentials
- Email: admin@aiproctor.com
- Password: admin123

## Authenticity Analysis Logic
1. **Query Intent Classification**:
   - `concept_clarification` - Asking "what is X?" (+0.1 penalty)
   - `approach_guidance` - Asking "how should I approach?" (+0.5 penalty)
   - `full_answer_request` - Asking "write my answer" (+2.0 penalty)
   - `debugging` - Asking for help with errors (+0.3 penalty)

2. **Understanding Levels**:
   - `INDEPENDENT` - No AI help or only conceptual questions
   - `GUIDED` - Used AI for approach guidance
   - `AI_DEPENDENT` - Requested full answers or high similarity detected

3. **Final Report Includes**:
   - Overall authenticity score (0-10)
   - Per-question breakdown
   - Key indicators (e.g., "High similarity between AI response and answer")
   - AI-generated narrative about usage patterns
