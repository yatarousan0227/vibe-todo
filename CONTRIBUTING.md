# Contributing to VibeToDo

Thank you for your interest in contributing! This document explains how to get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Submitting Changes](#submitting-changes)
- [Coding Guidelines](#coding-guidelines)

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- Node.js 20+
- Docker / Docker Compose
- An LLM provider API key (OpenAI, Anthropic, or Azure OpenAI)

### Local Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/<your-fork>/vibe-todo.git
cd vibe-todo

# 2. Install dependencies
npm ci

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your API keys and settings

# 4. Start PostgreSQL
docker compose up -d db

# 5. Initialize the database schema
npm run db:init

# 6. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development Workflow

### Branching

- `main` — stable, release-ready code
- `feat/<short-description>` — new features
- `fix/<short-description>` — bug fixes
- `chore/<short-description>` — maintenance / refactoring

### Running Tests

```bash
# Unit tests (Vitest)
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

All tests must pass before a pull request will be merged.

## Submitting Changes

1. Create a branch from `main`.
2. Make your changes with clear, focused commits.
3. Ensure all tests pass (`npm test`).
4. Open a pull request against `main` using the provided PR template.
5. Respond to review feedback promptly.

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]
[optional footer]
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

## Coding Guidelines

- **Language**: TypeScript — avoid `any`; prefer strict typing.
- **Formatting**: Follow the existing style; prettier/eslint configs apply.
- **Tests**: Every new feature or bug fix should include a corresponding test.
- **Security**: Do not commit secrets or API keys. Use `.env` locally and CI secrets in CI.

## Reporting Issues

Use the GitHub Issue templates:

- **Bug report** — for unexpected behavior
- **Feature request** — for new ideas or improvements

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
