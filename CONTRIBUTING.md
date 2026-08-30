# Contributing

Thank you for your interest in contributing to this project.

## Getting Started

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes following the conventions below
4. Push to your fork and open a pull request

## Development Workflow

This project uses an automated CI/CD pipeline:

- Push to `claude/*` branches to trigger automatic merge into `main`
- GitHub Actions handles merging, deployment, and branch cleanup
- No manual pull request merging is needed for `claude/*` branches

For external contributions, open a standard pull request against `main`.

## Conventions

### Version Bumping

- **`.gs` files:** Increment the `VERSION` variable by 0.01 (e.g. `"v01.13g"` → `"v01.14g"`)
- **Embedding HTML pages:** Increment the `build-version` meta tag by 0.01 (e.g. `"01.00w"` → `"01.01w"`) and update the corresponding `html.version.txt` file

### Commit Messages

- Prefix with version number(s) being updated: `v01.05w Fix auto-refresh loop`
- If no version files changed, no prefix needed

### Code Style

- 2-space indentation (enforced by `.editorconfig`)
- UTF-8 encoding, LF line endings
- No `alert()`, `confirm()`, or `prompt()` — use custom styled modals
- Every code file must end with: `Developed by: LightAISolutions`

### Template Rules

- The template files in `live-site-pages/templates/` don't have their own version files — templates are exempt from version tracking

See [CLAUDE.md](CLAUDE.md) for the full list of project conventions.

Developed by: LightAISolutions
