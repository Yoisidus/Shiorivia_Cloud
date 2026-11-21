# Cloud virtual IDE (staging)

The Cloud Officina IDE stores user-created project **names, relative directories, and text source files** in the current browser origin's IndexedDB. There are no real OS directories and no shared server storage.

- Project names and file paths reuse the Local path safety policy. File types must remain text/code only.
- Maximum file size: 256 KiB; maximum project size: 5 MiB; at most 500 files.
- The UI can create projects/folders, edit, save, list, and download files from this browser.
- `/api/ide` explicitly responds **410**. Server-side code inspection/AI patch execution is **not connected** to browser IndexedDB at this stage. Never promise the assistant can read or modify browser IDE files via a server call.
- Browser data is origin-specific and may be cleared by the user or browser. Export useful code regularly.
- The staging HTTP 503 guard remains enabled.
