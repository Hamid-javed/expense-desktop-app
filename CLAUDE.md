# Project: Expense & Sales Manager (EXPENDflow)

Electron desktop app — Next.js (App Router) + SQLite + Tailwind CSS. Single-tenant, single admin.

## Knowledge Graph

`graphify-out/.graphify_chunk_01.json` contains the full knowledge graph of this project — nodes, edges, hyperedges extracted from all source files. **Read this file first** when you need to understand project structure, entity relationships, or find where something is implemented.

Key things the graph captures:
- Core entities: Product, Staff, Route, Shop, Sale, Return, CreditPayment, User, InvoiceCounter
- Pages: products, staff, shops, routes, sales, reports
- Lib helpers: db.js, config.js, invoice.js, excel.js
- Architecture decisions: soft-delete pattern (`isActive`/`deletedAt`), no public registration, Electron desktop packaging

## Structure

```
src/app/        — Next.js pages + server actions
src/lib/        — db connection, config, invoice PDF, excel helpers
src/models/     — SQLite models (base.js + entity files)
graphify-out/   — knowledge graph chunks (project map)
```

## Key Conventions

- Soft deletes via `isActive` / `deletedAt` — never hard delete
- Single admin user seeded at startup — no registration flow
- Server Actions for all CRUD (no separate API routes except `/api/invoices/[id]`)
- SQLite via models in `src/models/sqlite/`
