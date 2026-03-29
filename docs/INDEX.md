# Documentation Index

Complete documentation for the Inventory App project.

**Last Updated**: 2026-03-29

---

## 📚 Quick Start

### New Users
1. **[README.md](../README.md)** - Project overview and quick start guide
2. **[project-status.md](./project-status.md)** - Canonical current priorities, active work, and next steps
3. **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** - Set up your Supabase backend (15-20 min)
4. **[LAUNCH_CHECKLIST.md](../LAUNCH_CHECKLIST.md)** - Deploy to production

### Existing Airtable Users
1. **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Migrate from Airtable to Supabase (30-45 min)

### AI Assistants (Claude Code)
1. **[CLAUDE.md](../CLAUDE.md)** - Instructions for AI assistants working with this codebase

---

## 📖 Documentation Categories

### Setup & Configuration
- **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** - Complete Supabase setup guide
  - Create project, database schema, environment variables
  - Testing, verification, RLS policies
  - Production deployment

- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Airtable to Supabase migration
  - Safe, non-destructive migration strategy
  - Export/import scripts, verification steps
  - Rollback plan

- **[LAUNCH_CHECKLIST.md](../LAUNCH_CHECKLIST.md)** - Production deployment checklist
  - Pre-launch tasks, environment setup
  - Vercel deployment steps

### Architecture & Specifications
- **[project_architecture_structure.md](./project_architecture_structure.md)** - Overall architecture
- **[project-status.md](./project-status.md)** - Canonical control tower for current work
- **[README.md](./README.md)** - Documentation home and navigation
- **[specs/](./specs/)** - Feature specifications (BDD scenarios)
  - `mvp_scope_lean.md` - Lean MVP scope
  - `scanner.md` - Barcode scanning
  - `product_management.md` - Product CRUD
  - `stock_management.md` - Stock movements
  - `xlsx_integration.md` - Excel import/export
  - `invoice_automation_research.md` - Invoice OCR
  - And more...

### Development Guides
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment procedures
- **[IMPROVEMENTS_SUMMARY_2025-12-13_14.md](./IMPROVEMENTS_SUMMARY_2025-12-13_14.md)** - Recent improvements log

### Architecture Decision Records (ADRs)
- **[adrs/](./adrs/)** - Architecture decisions with rationale
  - `ADR-0001-airtable-backend-proxy.md` - Backend proxy decision

### Project Management
- **[project-status.md](./project-status.md)** - Canonical project status and handoff layer
  - Current priorities, active work, recently completed, next up
  - Links to canonical plans and decision notes

- **[../feature_list.json](../feature_list.json)** - Feature tracking database
  - 30 features with implementation and testing status
  - BDD scenarios, test files

### Reports

#### Design & UX
- **[reports/ui-ux-audit.md](./reports/ui-ux-audit.md)** - Comprehensive UI/UX audit
  - 38 issues identified (Critical, High, Medium, Low)
  - Design system violations, accessibility issues

#### Testing
- **[test-reports/](./test-reports/)** - All test reports
  - `TEST_INDEX.md` - Test suite index
  - `TEST_SUMMARY.md` - Overall test summary
  - `TESTING_SUMMARY.md` - Testing overview
  - `CRUD_ERROR_HANDLING_TEST_REPORT.md` - CRUD error handling tests
  - `STOCK_MOVEMENT_TEST_REPORT.md` - Stock movement tests
  - `STOCK_MOVEMENT_TEST_RESULTS.md` - Stock test results
  - `VISUAL_TEST_REPORT.md` - Visual regression tests
  - `VISUAL_TEST_SUMMARY.md` - Visual test summary
  - `VISUAL_TESTING_GUIDE.md` - Visual testing guide

### Mockups & Designs
- **[mockups/](./mockups/)** - Interactive UI mockups
  - `checkout-ux-proposals.html` - Checkout cart UI (4 variants, 88KB)
  - `checkout-completion-ux-proposals.html` - Checkout completion screens (83KB)
  - `inventory-ux-proposals.html` - Inventory management UI (51KB)
  - `invoice-upload-ui-variants.html` - Invoice upload UI (72KB)
  - `README.md` - Mockups documentation

- **[proposals/](./proposals/)** - UX design proposals
  - `product-edit-ux-proposals-v3.html` - Product edit dialog variants (79KB)
  - `README.md` - Proposals documentation

- **[public/test-invoices/](../public/test-invoices/)** - Test invoice HTML files
  - `invoice-simple.html` - Simple invoice (5 products, no barcodes)
  - `invoice-with-barcodes.html` - Invoice with EAN-13 barcodes (7 products)
  - `invoice-mixed.html` - Realistic mixed invoice (9 products)
  - `README.md` - Testing instructions

---

## 🔍 Finding Documentation

### By Topic

**Backend & Database:**
- Supabase setup → `SUPABASE_SETUP.md`
- Migration → `MIGRATION_GUIDE.md`
- API architecture → `CLAUDE.md` (Backend Integration section)

**Features:**
- Specifications → `specs/` directory
- Testing → `test-reports/` directory
- Current status / handoff → `project-status.md`

**Deployment:**
- Production launch → `LAUNCH_CHECKLIST.md`
- Troubleshooting → `TROUBLESHOOTING.md`
- Environment setup → `../README.md` + `../.env.example`

**Design:**
- UI/UX audit → `reports/ui-ux-audit.md`
- Mockups → `mockups/` directory

### By Role

**Developers:**
1. `../CLAUDE.md` - Code architecture and patterns
2. `project_architecture_structure.md` - System design
3. `specs/` - Feature specifications
4. `TROUBLESHOOTING.md` - Common issues

**Product Managers:**
1. `../README.md` - Project overview
2. `project-status.md` - Current priorities and handoff context
3. `../feature_list.json` - Feature status
4. `specs/mvp_scope_lean.md` - MVP scope

**DevOps:**
1. `LAUNCH_CHECKLIST.md` - Deployment guide
2. `DEPLOYMENT.md` - Deployment procedures
3. `SUPABASE_SETUP.md` - Backend setup
4. `TROUBLESHOOTING.md` - Issue resolution

**Designers:**
1. `reports/ui-ux-audit.md` - UX audit findings
2. `mockups/` - Design variants
3. `../CLAUDE.md` - Design system ("Fresh Precision")

---

## 📝 Documentation Standards

### File Naming
- Use lowercase with hyphens: `my-document.md`
- Exception: Root files use CAPS for visibility: `README.md`, `CLAUDE.md`

### Location Guidelines
- **Root** (`/`): User-facing docs (README, CLAUDE, LAUNCH_CHECKLIST)
- **`docs/`**: All other documentation
- **`docs/specs/`**: Feature specifications
- **`docs/adrs/`**: Architecture decisions
- **`docs/reports/`**: Audit and analysis reports
- **`docs/test-reports/`**: Testing reports
- **`docs/project/`**: Project management files

### When to Update
- **Specs**: When requirements change or features are implemented
- **Project status**: In every PR that changes shipped behavior, priorities, roadmap order, or "what's next"
- **Reports**: After audits, tests, or analysis
- **Architecture**: When making significant design decisions

---

## 🔗 External Resources

- **Supabase Docs**: https://supabase.com/docs
- **Airtable API**: https://airtable.com/developers/web/api/introduction
- **Claude Code**: https://claude.com/claude-code
- **Project Repository**: [Your GitHub URL]

---

## 📞 Support

- **Technical Issues**: Check `TROUBLESHOOTING.md` first
- **Feature Requests / current priority order**: Start with `project-status.md`, then inspect `../feature_list.json` and `docs/plans/`
- **Questions**: Open an issue or discussion on GitHub

---

**Organization Note**: This documentation was reorganized on 2025-12-18 to improve maintainability. All test reports and analysis documents were moved from root to `docs/` subdirectories.
