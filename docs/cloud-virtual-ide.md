# Cloud virtual IDE (staging)

The Cloud Officina IDE stores user-created project **names, relative directories, and text source files** in the current browser origin's IndexedDB. There are no real OS directories and no shared server storage.

- Project names and file paths reuse the Local path safety policy. File types must remain text/code only.
- Maximum file size: 256 KiB; maximum project size: 5 MiB; at most 500 files.
- The UI can create projects/folders, edit, save, list, download individual files, and **export the entire current root project as a ZIP**.
- The top-bar **Export project** button replaces the old **Sync** button. The ZIP contains `<project>/` at its root and preserves nested files and empty directories. Extract the archive **inside Local's `IDE/` folder**, e.g. `Shiorivia/IDE/WeatherApp/src/main.ts`, then bind it in Local Officina.
- Export uses only saved browser files and warns if the editor has unsaved drafts; it does not upload anything. ZIP entries are validated by the IDE safe-path policy, limited to the project's 500 files / 5 MiB, and UTF-8 filenames. Native compression is used when supported; otherwise the output remains a compatible uncompressed ZIP.
- `/api/ide` explicitly responds **410**. There is **no server filesystem access**. Officina AI can propose new files and <ide_edit> patches; approved changes are previewed and written by the client via IndexedDB.
- When an Officina request needs existing project source, the client **asks for confirmation before sharing** a bounded sample (at most 8 files / 32,000 characters, and at most 7,500 characters per file) with the selected model through the Cloud proxy. If declined, the model receives no project files and must not invent existing code.
- AI context is intentionally limited: large projects can need the user to supply relevant snippets separately. Source contents can contain secrets even if filenames look harmless, so review carefully before approving any code sharing.
- Browser data is origin-specific and may be cleared by the user or browser. Export useful code regularly.
- The staging HTTP 503 guard remains enabled.
