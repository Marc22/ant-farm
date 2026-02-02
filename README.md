# Ant Farm

This is a copy of the Vite + React + TypeScript todo starter with GitHub Pages deploy configured.

How to run (PowerShell):

```powershell
npm install
npm run dev
```

Build for production:

```powershell
npm run build
```

View the demo site at: https://marc22.github.io/ant-farm/

## Branch protection (apply rules)

To protect `main`, you can apply a branch-protection rule using the GitHub API. A helper script is in `scripts/apply_branch_protection.sh`.

Example (bash):

```bash
export GITHUB_TOKEN=ghp_...  # PAT with repo:admin or repo scope
./scripts/apply_branch_protection.sh Marc22 ant-farm main your-github-username
```

The script will PUT a protection rule to require PR reviews, require status checks, disallow force-push and deletions, and enforce linear history. If you need to restrict who can push, pass a comma-separated list of allowed users as the fourth arg.

See `scripts/branch-protection-template.json` for a JSON template you can edit to customize checks.
