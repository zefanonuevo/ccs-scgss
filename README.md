# CCS Student Conference Grant Support System (SCGSS)

Mockups and a working simulation for the CCS student conference grant process: application form, approval workflow, document verification, reimbursement, and the FAO report.

**Live:** https://zefanonuevo.github.io/ccs-scgss/ (or open `index.html` in a browser)

- All names, amounts, dates and links are fictional sample data.
- Nothing here is a deployed system. The simulation runs entirely in the browser and sends nothing.
- Anything not stated in the supplied application form and guidelines is marked as an assumption to confirm.

## Design system

Uses the same macOS-style design tokens, type, motion and theme switch (System, Light, Dark) as [ccs-task-tracker](https://github.com/zefanonuevo/ccs-task-tracker), so the two can later be merged into one site. The token block at the top of `index.html` is identical in both. This file also keeps a few older token names as aliases of the shared ones.

- System font stack, no downloaded fonts.
- Press feedback 160ms, toasts 240ms in and 160ms out, no animation on tab switches, reduced motion becomes a 120ms fade.
- The header scrolls away on phones and only the tab strip stays pinned.
