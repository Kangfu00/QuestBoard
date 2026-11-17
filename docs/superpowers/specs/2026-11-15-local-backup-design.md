# Local backup and Windows login startup

The user wants quests to survive browser-data deletion and wants the board to open when Windows starts. Existing app uses IndexedDB and a loopback Node static server.

Use the existing server to write validated JSON into `D:\Pro_J\บอร์ด\Questboard-Backups`, outside the served web directory. Keep latest.json plus 30 previous changed versions. Replace files atomically; recover from a valid prior version if the latest is corrupt. Browser saves continue, with a visible distinction between browser-only and file-backed saves. After browser data is cleared, load the disk copy before creating any sample data. Existing browser data migrates on the first reload of the updated app. Pending browser changes must not silently overwrite a newer disk revision; offer a source choice on conflict.

Use a current-user Windows Startup shortcut, starting Node hidden, checking a local health endpoint, then opening the default browser. Do not require admin or change execution policy. Provide disable/uninstall and manual start scripts. Existing server may be restarted only after its executable and command line identify this project.

Alternatives considered: timed downloads require browser permission and create duplicate download files; File System Access grants can be lost when clearing browser data. The existing local server handles unattended disk writes and restoration reliably. These implementation defaults are agent choices within the user's requested local-only workflow.

Keep server bound to loopback. Reject foreign origins/hosts and invalid backups. Do not expose arbitrary file reads/writes. Do not read browser data through another surface: localhost browser access is blocked by a saved tool policy. Test with disposable states and temporary directories, and clearly distinguish those checks from live browser QA.
