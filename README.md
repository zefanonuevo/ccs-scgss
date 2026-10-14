# CCS Student Conference Grant Support System (SCGSS)

Mockups and a working simulation for the CCS student conference grant process: application form, approval workflow, document verification, reimbursement, and the FAO report.

**Live:** https://zefanonuevo.github.io/ccs-scgss/ (or open `index.html` in a browser while online)

- All names, amounts, dates and links are fictional sample data.
- Nothing here is a deployed system. The simulation runs entirely in the browser and sends nothing.
- Anything not stated in the supplied application form and guidelines is marked as an assumption to confirm.

## Design system

Same macOS-style design as [ccs-task-tracker](https://github.com/zefanonuevo/ccs-task-tracker): system font stack, frosted toolbar, segmented tabs, and a System, Light or Dark theme switch.

Colors, shadows, easing, type and the theme switch styles load from the shared stylesheet in [ccs-design](https://github.com/zefanonuevo/ccs-design). This file keeps a few older variable names as aliases of the shared ones.

- Press feedback 160ms, toasts 240ms in and 160ms out, no animation on tab switches, reduced motion becomes a 120ms fade.
- The header scrolls away on phones and only the tab strip stays pinned.

The page needs a network connection to load the shared stylesheet. Opened offline, it loses its colors.
