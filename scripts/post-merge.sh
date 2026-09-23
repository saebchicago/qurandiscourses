#!/usr/bin/env bash
set -euo pipefail

# This project has no dependencies or generated build output to restore.
# Keep the hook as an explicit, idempotent success so workflow reconciliation
# can run after task-agent merges.
echo "No post-merge setup required."