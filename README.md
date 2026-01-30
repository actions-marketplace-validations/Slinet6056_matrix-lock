<p align="center" style="text-align: center">
  <a href="https://github.com/Slinet6056/matrix-lock">
    <img alt="Matrix Lock Logo" src=".github/icon.png" width="128" height="128" />
  </a>
</p>

<h3 align="center">Matrix Lock</h3>
<p align="center">
    Sequential execution control for GitHub Actions matrix workflows
</p>

<div align="center">

[![MIT License](https://img.shields.io/github/license/Slinet6056/matrix-lock)](https://github.com/Slinet6056/matrix-lock/blob/main/LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/Slinet6056/matrix-lock)](https://github.com/Slinet6056/matrix-lock/releases)

</div>

## About

Matrix Lock is a GitHub Action that provides a locking mechanism to control the execution order of jobs in matrix workflows. It ensures jobs run sequentially rather than in parallel, preventing race conditions and conflicts when needed.

## Features

- ✨ Simple three-step workflow (init → wait → continue)
- 🔒 Ensures sequential execution within matrix jobs
- ⚡ Built with TypeScript and modern tooling
- 📦 Uses GitHub Actions Artifact API v2
- 🛡️ Robust error handling and retry logic
- 📊 Detailed logging for debugging

## How It Works

The action uses GitHub's Artifact storage to manage a lock file that controls job execution order:

1. **Initialize (`init`)**: Creates a lock file with the execution order
2. **Wait (`wait`)**: Jobs poll the lock file until it's their turn
3. **Continue (`continue`)**: Releases the lock for the next job in queue

## Usage

### Basic Example

```yaml
name: Sequential Matrix Build

on: [push]

jobs:
    build:
        runs-on: ubuntu-latest
        strategy:
            matrix:
                include:
                    - id: job-1
                      name: "First Job"
                    - id: job-2
                      name: "Second Job"
                    - id: job-3
                      name: "Third Job"

        steps:
            - name: Checkout
              uses: actions/checkout@v4

            # Initialize lock (only first job)
            - name: Initialize matrix lock
              if: matrix.id == 'job-1'
              uses: Slinet6056/matrix-lock@v2
              with:
                  step: init
                  order: "job-1,job-2,job-3"

            # Wait for turn (all jobs)
            - name: Wait for lock
              uses: Slinet6056/matrix-lock@v2
              with:
                  step: wait
                  id: ${{ matrix.id }}
                  retry-count: 12
                  retry-delay: 10

            # Your actual job steps go here
            - name: Run build
              run: |
                  echo "Running ${{ matrix.name }}"
                  # Your build commands...

            # Release lock (all jobs)
            - name: Release lock
              if: always()
              uses: Slinet6056/matrix-lock@v2
              with:
                  step: continue
```

### Advanced Example with Custom Retry Logic

```yaml
- name: Wait for lock with custom retry
  uses: Slinet6056/matrix-lock@v2
  with:
      step: wait
      id: ${{ matrix.id }}
      retry-count: 20 # Try 20 times
      retry-delay: 15 # Wait 15 seconds between attempts
```

## Inputs

| Input         | Description                                                         | Required | Default |
| ------------- | ------------------------------------------------------------------- | -------- | ------- |
| `step`        | Action to perform: `init`, `wait`, or `continue`                    | Yes      | -       |
| `order`       | Comma-separated list of job IDs (required for `init`)               | No       | -       |
| `id`          | Unique identifier for this job (required for `wait` and `continue`) | No       | -       |
| `retry-count` | Maximum number of retry attempts                                    | No       | `6`     |
| `retry-delay` | Delay in seconds between retries                                    | No       | `10`    |

## Common Patterns

### Sequential Database Migrations

```yaml
strategy:
    matrix:
        migration: [init-db, add-users, add-posts, add-comments]

steps:
    - name: Initialize lock
      if: matrix.migration == 'init-db'
      uses: Slinet6056/matrix-lock@v2
      with:
          step: init
          order: "init-db,add-users,add-posts,add-comments"

    - name: Wait for lock
      uses: Slinet6056/matrix-lock@v2
      with:
          step: wait
          id: ${{ matrix.migration }}

    - name: Run migration
      run: npm run migrate:${{ matrix.migration }}

    - name: Release lock
      if: always()
      uses: Slinet6056/matrix-lock@v2
      with:
          step: continue
```

### Sequential Deployments

```yaml
strategy:
    matrix:
        environment: [dev, staging, production]

steps:
    - name: Initialize deployment lock
      if: matrix.environment == 'dev'
      uses: Slinet6056/matrix-lock@v2
      with:
          step: init
          order: "dev,staging,production"

    - name: Wait for deployment slot
      uses: Slinet6056/matrix-lock@v2
      with:
          step: wait
          id: ${{ matrix.environment }}
          retry-count: 30
          retry-delay: 20

    - name: Deploy to ${{ matrix.environment }}
      run: ./deploy.sh ${{ matrix.environment }}

    - name: Release lock
      if: always()
      uses: Slinet6056/matrix-lock@v2
      with:
          step: continue
```
