# Tasks App

Frontend task management application built with Angular.

## Stack

- Angular 21 (standalone components, Router, HttpClient)
- TypeScript
- SCSS
- RxJS
- date-fns (date and calendar formatting)
- Node.js + npm

## Prerequisites

- Node.js 20+ (LTS recommended)
- npm 10+
- Backend API running and reachable from this frontend

## Clone and Run (Quick Start)

```bash
git clone <your-repository-url>
cd <repo-root>/frontend/tasks-app
npm install
npm start
```

Then open:

- `http://localhost:4200/`

## Run Locally (Detailed Steps)

1. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   ```
2. **Enter the frontend app folder**
   ```bash
   cd <repo-root>/frontend/tasks-app
   ```
3. **Install dependencies**
   ```bash
   npm install
   ```
4. **Check environment configuration**
   - Review:
     - `src/environments/environment.ts`
     - `src/environments/environment.development.ts`
   - Ensure `apiBaseUrl` points to your backend API.
5. **Start the development server**
   ```bash
   npm start
   ```
6. **Open the app in browser**
   - `http://localhost:4200/`

## Useful Commands

- Start dev server: `npm start`
- Build app: `npm run build`
- Run tests: `npm test`

## Notes

- The app expects a running backend for authentication and tasks API endpoints.
- If the page is blank, check:
  - Terminal output from `npm start`
  - Browser console errors
  - API URL configuration in environment files
