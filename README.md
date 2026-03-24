# ChoiceScript to Twine Converter

A visual editor for building choose-your-own-adventure stories and exporting them to SugarCube/Twine-compatible output.

This project combines a block-based narrative editor, a scene flowchart view, and live code/game preview to help you author branching fiction without hand-writing every macro.

<img width="1186" height="770" alt="image" src="https://github.com/user-attachments/assets/82a7fa93-1767-4256-b2b7-f650633a6ab1" />

<img width="1805" height="859" alt="image" src="https://github.com/user-attachments/assets/b4e255b4-4e3c-4a57-89f2-d1a00110fd3e" />

<img width="1244" height="770" alt="image" src="https://github.com/user-attachments/assets/872abc0e-8d07-4d75-b8a0-841f8a13b040" />


## Features

- Block editor with story, branching, and logic blocks (paragraphs, choices, `if/else`, variable `set`, labels, goto, scene jumps, endings)
- Scene flowchart powered by React Flow for visual branching maps
- Variable panel and stat chart support for game state design
- Undo/redo history and autosave to local storage
- Code preview and embedded play preview
- Export options:
  - Standalone SugarCube HTML
  - Scene text ZIP output
  - Native project JSON

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### Install and run

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Scripts

```bash
npm run dev      # Start local dev server
npm run build    # Type-check and production build
npm run lint     # ESLint checks
npm run preview  # Preview production build
```

## Basic Workflow

1. Create or select scenes in the sidebar.
2. Build scene content using blocks in the editor.
3. Define variables and branching conditions.
4. Use the flowchart to inspect scene links.
5. Use Code/Play preview to validate output.
6. Export as SugarCube HTML, ZIP text, or project JSON.

## Example Projects

Sample project files are available in `public/`:

- `demo-solo-leveling.json`
- `my-homestead-life.json`
- `demo-image-workflow.json`

## Project Structure

- `src/components/` UI views (editor, flowchart, preview, sidebar, top bar)
- `src/store/` Zustand project state and actions
- `src/codegen/` scene/block generation logic
- `src/exporters/` Twine/SugarCube export pipeline
- `src/export/` project and Twine export entry points
- `src/types/` shared project types

## Known Limitations

- JSON import expects valid project shape (limited validation)
- Startup scene conventions must be respected for exports
- Autosave uses browser localStorage limits
- Current export target focuses on SugarCube format
- In Preview/Twine export, a scene that ends with unconditional `goto`/`goto_scene` will auto-navigate immediately (add a `choice` first if you want the player to pause on that scene)

## License

MIT. See [LICENSE](./LICENSE).
