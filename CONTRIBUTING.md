# Contributing to DevPulse

Thank you for your interest in contributing to DevPulse! We welcome contributions from the community and are grateful for every pull request, bug report, and feature suggestion.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

By participating in this project, you agree to treat all contributors with respect and foster an inclusive, welcoming environment.

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/DevPulse.git
   cd DevPulse
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/ashishnayak04/DevPulse.git
   ```

## Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 16+
- Redis 7+

### Install Dependencies

```bash
npm run install:all
```

### Configure Environment

Copy `backend/.env.example` to `backend/.env` and fill in your local values:

```bash
cp backend/.env.example backend/.env
```

### Database Setup

```bash
npm --prefix backend run db:migrate
npm run db:seed      # Creates the admin account
```

### Start Development Servers

**Option A — PowerShell script (Windows):**
```powershell
.\start-dev.ps1
```

**Option B — Manual (any OS):**
```bash
# Terminal 1 — Backend
npm run dev:backend

# Terminal 2 — Frontend
npm run dev:frontend
```

The app will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:4000

### Run Smoke Tests

```bash
node backend/scripts/smoke-test.js
```

## Making Changes

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. **Make your changes** — keep commits small and focused.
3. **Run the smoke tests** to ensure nothing is broken:
   ```bash
   node backend/scripts/smoke-test.js
   ```
4. **Commit** with a descriptive message:
   ```bash
   git commit -m "feat: add webhook retry configuration UI"
   ```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix    | Use for                          |
|-----------|----------------------------------|
| `feat:`   | New feature                      |
| `fix:`    | Bug fix                          |
| `docs:`   | Documentation changes            |
| `style:`  | Formatting, no code change       |
| `refactor:` | Code change, no new feature    |
| `test:`   | Adding or updating tests         |
| `chore:`  | Build process, tooling changes   |

## Pull Request Process

1. **Push** your branch to your fork:
   ```bash
   git push origin feat/your-feature-name
   ```
2. **Open a Pull Request** against `main` on the upstream repository.
3. **Describe your changes** clearly in the PR description.
4. **Link any related issues** (e.g., `Closes #42`).
5. A maintainer will review your PR and may request changes.

## Reporting Bugs

Please [open an issue](https://github.com/ashishnayak04/DevPulse/issues/new) and include:

- A clear, descriptive title.
- Steps to reproduce the issue.
- Expected vs. actual behavior.
- Your environment (OS, Node version, browser).
- Any relevant logs or screenshots.

## Suggesting Features

We love feature ideas! Please [open an issue](https://github.com/ashishnayak04/DevPulse/issues/new) with:

- A clear description of the feature.
- The problem it solves or the use case.
- Any suggested implementation approach.

---

Thank you for helping make DevPulse better! 🚀
