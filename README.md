# BPMN Visual Merge Tool

A free, browser-based tool for visually comparing and merging Camunda BPMN process diagrams. Upload two `.bpmn` files, review changes side-by-side with highlighted diffs, cherry-pick modifications at the attribute level, and export a clean merged BPMN.

**Live demo:** [bpmn-merger.vercel.app](https://bpmn-merger.vercel.app/)

## Features

- **Side-by-side diagram comparison** — BASE and NEW panels rendered with [bpmn-js](https://github.com/bpmn-io/bpmn-js)
- **Semantic diff highlighting** — added (green), modified (amber), removed (red) elements
- **Attribute-level cherry-pick** — expand a modified element to toggle individual attribute or child-element changes
- **Shift+Click multi-select** — select a range of changes at once, similar to Camunda Modeler
- **Merged BPMN export** — download the result as a valid `.bpmn` file
- **Drag & drop upload** — drop files directly onto the panels

## Tech Stack

React · TypeScript · Tailwind CSS v4 · Vite · bpmn-js

## Getting Started

```bash
# install dependencies
npm install

# start dev server
npm run dev

# production build
npm run build
```

## How It Works

1. **Upload** a BASE and a NEW `.bpmn` file (drag & drop or click to browse).
2. **Compare** — the tool parses both XMLs, computes a semantic diff, and highlights differences on both diagrams.
3. **Select** — use the sidebar to pick which changes to include. Expand modified elements to cherry-pick at attribute level.
4. **Export** — download the merged BPMN with only the selected changes applied.

## Project Structure

```
src/
├── lib/
│   ├── parser.ts    # BPMN XML parsing & semantic diff
│   ├── merger.ts    # Multi-pass merge engine
│   └── types.ts     # Shared type definitions
├── components/
│   ├── BpmnViewer.tsx   # bpmn-js diagram renderer
│   ├── DropZone.tsx     # File upload drop zone
│   ├── Sidebar.tsx      # Change list with sub-change expansion
│   └── StatusBar.tsx    # Summary status bar
└── App.tsx              # Main layout & state management
```

## Deployment

Configured for Vercel out of the box — push to your repo and import in Vercel. See `vercel.json` for settings.

## License

MIT

## Author

[Umut Atagun](https://www.linkedin.com/in/umutatagun)
