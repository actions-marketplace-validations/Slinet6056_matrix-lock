# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Matrix Lock is a GitHub Action that provides sequential execution control for matrix workflows using GitHub's Artifact API v2. The action implements a distributed locking mechanism through artifact upload/download operations to ensure matrix jobs execute in a specific order rather than in parallel.

## Build and Development Commands

```bash
# Install dependencies
pnpm install

# Format code
pnpm run format
pnpm run format-check

# Lint code
pnpm run lint

# Build the action (compiles TypeScript and bundles with ncc)
pnpm run build

# Build consists of two steps:
# 1. Compile TypeScript and bundle with @vercel/ncc
pnpm run build:compile
# 2. Clean up unnecessary files (declaration files, source maps)
pnpm run build:cleanup
```

## Architecture

### Core Components

**Single Entry Point**: `src/index.ts` - Contains all action logic in one file with three main operation modes:

1. **init**: First job creates lock file with execution order and uploads to artifacts
2. **wait**: Jobs poll artifact storage until lock becomes available for their ID
3. **continue**: Current job releases lock by removing itself from queue and re-uploading

### Locking Mechanism

The action uses a simple but effective queue-based approach:

- **Lock file**: Contains comma-separated list of job IDs in execution order
- **Storage**: GitHub Actions Artifact API v2 (`@actions/artifact`)
- **File name**: `matrix-lock-17c3b450-53fd-4b8d-8df8-6b5af88022dc.lock` (UUID prevents conflicts)
- **Artifact name**: `matrix-lock`

### Execution Flow

1. First matrix job initializes lock with full job ID order
2. All jobs repeatedly download artifact and check if they're first in queue
3. When job's turn arrives, it executes its work
4. Job removes itself from queue and uploads updated lock
5. Next job in queue detects change and proceeds

### Error Handling

- Retry logic with configurable attempts (`retry-count`, default: 6) and delays (`retry-delay`, default: 10s)
- Artifact download failures are caught and retried
- Maximum retry limit prevents infinite loops
- Detailed logging at each step for debugging

## Build Output

The action must be built and committed to `dist/` directory:
- `dist/index.js` - Bundled action code (used by GitHub Actions runner)
- `dist/licenses.txt` - Third-party licenses
- All TypeScript declaration files and source maps are removed post-build

**Critical**: The `dist/` directory must be committed. CI checks ensure no uncommitted changes exist in `dist/` after build.

## GitHub Actions Configuration

- Runs on Node.js 20 (`runs.using: 'node20'`)
- Main entry: `dist/index.js`
- Requires `GITHUB_WORKSPACE` environment variable
- Uses GitHub Actions toolkit: `@actions/core` and `@actions/artifact`

## Key Constraints

- The lock file name uses a UUID to avoid conflicts between different workflow runs
- All three operations (init, wait, continue) work on the same artifact name
- The `wait` step must use polling because GitHub Actions doesn't support push notifications
- Jobs must handle artifact download failures gracefully (first job's artifact may not exist yet)
