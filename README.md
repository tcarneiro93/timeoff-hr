# TimeOff HR — Setup Guide

## Requirements
- Node.js 18+ (https://nodejs.org)

## 1. Install dependencies
```bash
npm install
```

## 2. Configure settings
Copy `config.env` to `.env` and fill in your values:
```bash
cp config.env .env
```

Edit `.env`:
```
PORT=3000
SESSION_SECRET=any-long-random-string-here

# Microsoft 365 SMTP
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-email-password
EMAIL_FROM=TimeOff HR <your-email@yourdomain.com>

# URL used in email links (change if deploying to a server)
APP_URL=http://localhost:3000
```

## 3. Import your staff
Start the server first:
```bash
npm start
```

Then open http://localhost:3000 and sign in as a manager.
Go to **Import staff** in the sidebar and upload your JSON file.

### Staff JSON format
```json
[
  {
    "id": "ana.silva",
    "name": "Ana Silva",
    "email": "ana.silva@yourcompany.com",
    "role": "staff",
    "location": "Lisbon",
    "daysTotal": 25,
    "daysUsed": 0,
    "managerId": "maria.manager",
    "password": "welcome1"
  },
  {
    "id": "maria.manager",
    "name": "Maria Lopes",
    "email": "maria.lopes@yourcompany.com",
    "role": "manager",
    "location": "Lisbon",
    "daysTotal": 25,
    "daysUsed": 0,
    "managerId": null,
    "password": "welcome1"
  }
]
```

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `id` | ✓ | Login username (no spaces) |
| `name` | ✓ | Full display name |
| `email` | ✓ | For email notifications |
| `role` | ✓ | `"staff"` or `"manager"` |
| `location` | — | Office/city |
| `daysTotal` | ✓ | Annual entitlement |
| `daysUsed` | — | Days already taken (default 0) |
| `managerId` | ✓ for staff | The `id` of their manager |
| `password` | — | Initial password (default `1234`) |

## 4. Run in production (Linux VPS)
Use PM2 to keep it running:
```bash
npm install -g pm2
pm2 start server.js --name timeoff
pm2 save
pm2 startup
```

Then put Nginx in front of it for HTTPS (recommended).

## Data
All data is stored in `data/db.json`. Back this file up regularly.
