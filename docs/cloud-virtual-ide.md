# Cloud virtual IDE (staging)

The Cloud Officina IDE stores user-created project **names, relative directories, and text source files** in the current browser origin's IndexedDB. There are no real OS directories and no shared server storage.

- Project names and file paths reuse the Local path safety policy. File types must remain text/code only.
- Maximum file size: 256 KiB; maximum project size: 5 MiB; at most 500 files.
- The UI can create projects/folders, edit, save, list, download individual files, and **export the entire current root project as a ZIP**.
- The top-bar **Export project** button replaces the old **Sync** button. The ZIP contains `<project>/` at its root and preserves nested files and empty directories. Extract the archive **inside Local's `IDE/` folder**, e.g. `Shiorivia/IDE/WeatherApp/src/main.ts`, then bind it in Local Officina.
- Export uses only saved browser files and warns if the editor has unsaved drafts; it does not upload anything. ZIP entries are validated by the IDE safe-path policy, limited to the project's 500 files / 5 MiB, and UTF-8 filenames. Native compression is used when supported; otherwise the output remains a compatible uncompressed ZIP.
- `/api/ide` explicitly responds **410**. Server-side code inspection/AI patch execution is **not connected** to browser IndexedDB at this stage. Never promise the assistant can read or modify browser IDE files via a server call.
- Browser data is origin-specific and may be cleared by the user or browser. Export useful code regularly.
- The staging HTTP 503 guard remains enabled.
