#!/usr/bin/env bash
# apply_branch_protection.sh
# Usage:
#   export GITHUB_TOKEN=ghp_...   # or set GITHUB_TOKEN in env
#   ./scripts/apply_branch_protection.sh Marc22 ant-farm main
# This will PUT a branch protection rule for the branch specified.

set -euo pipefail
if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <owner> <repo> <branch> [allowed_user1,allowed_user2,...]"
  exit 2
fi
OWNER=$1
REPO=$2
BRANCH=$3
ALLOWED_PUSH_USERS=${4-}

if [ -z "${GITHUB_TOKEN-}" ]; then
  echo "Please set GITHUB_TOKEN environment variable with repo permissions (or a PAT)."
  exit 2
fi

API_URL="https://api.github.com/repos/${OWNER}/${REPO}/branches/${BRANCH}/protection"

# Build restrictions object if allowed push users provided
RESTRICTIONS_JSON="null"
if [ -n "$ALLOWED_PUSH_USERS" ]; then
  IFS=',' read -ra USERS <<< "$ALLOWED_PUSH_USERS"
  USERS_JSON="["
  first=true
  for u in "${USERS[@]}"; do
    if [ "$first" = true ]; then
      USERS_JSON+='"'${u}'"'
      first=false
    else
      USERS_JSON+=',"'${u}'"'
    fi
  done
  USERS_JSON+=']'
  RESTRICTIONS_JSON="{ \"users\": $USERS_JSON, \"teams\": [] }"
fi

# Default protection payload: require PR reviews, require status checks, disallow force pushes
read -r -d '' PAYLOAD << EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": []
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": ${RESTRICTIONS_JSON},
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true
}
EOF

# Perform API call
resp=$(curl -s -o /dev/stderr -w "%{http_code}" -X PUT "$API_URL" \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -d "$PAYLOAD")

if [ "$resp" = "200" ] || [ "$resp" = "201" ]; then
  echo "Branch protection applied to ${OWNER}/${REPO}@${BRANCH}"
else
  echo "Failed to apply branch protection, HTTP status: $resp" >&2
  exit 3
fi
