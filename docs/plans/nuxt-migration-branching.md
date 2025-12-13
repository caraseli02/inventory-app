# Nuxt migration branch strategy

This project should keep the React application on `main` while the Nuxt migration progresses on a long-lived branch.

## Branch topology
- Create and maintain a long-lived `nuxt-migration` branch based on `main`.
- Open short-lived feature branches from `nuxt-migration` for each migration step (e.g. `nuxt-migration/scaffold`, `nuxt-migration/providers`).
- Merge feature branches back into `nuxt-migration` only. Keep `main` focused on the current React app until Nuxt reaches full parity.

## Workflow steps
1. Update local `main` to the latest React app state.
2. Ensure `nuxt-migration` is rebased or merged from `main` when necessary to incorporate upstream fixes.
3. Branch from `nuxt-migration` for each scoped task, push changes, and open PRs targeting `nuxt-migration`.
4. After migration parity is verified, prepare a final PR from `nuxt-migration` into `main` to switch the default app.
