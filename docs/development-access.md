# Forecast service access

The forecast feature became public on 27 November 2026 at the owner's explicit request. The anonymous GET-only `/public/data/` route serves an exact allowlist of the ten model files, manifest, health, CLPP metadata, province geometry and hashed CLPP PNG frames. Station snapshots, legacy unused models, arbitrary paths and sessions are excluded. The read responses cache for five minutes.

`/admin/snapshot` still requires the independent uploader token. Existing authenticated `/data/` and auth endpoints retain their server-side checks; public visitors do not use them. Neither passwords nor uploader tokens appear in the public client. The R2 snapshot remains atomic and retains its previous generation for in-flight images.

GitHub Actions restores and updates the protected cache, then uploads using its existing secret. Raw snapshots are still excluded from the Pages artifact; only the explicitly published server reads are anonymous. Tests verify anonymous forecast access, rejection of unrelated files and anonymous uploads, and the original login protections.
