# Sharing completion

Continue approved sharing scope. First remove history truncation with stable timestamp/ID cursors, server-filtered folders/authors, and revalidation of loaded records after deletion. Defer media downloads until near the viewport. Then connect chat avatars to author-filtered updates and unread status. Profile avatar upload requires a profile-owned asset authorization model; do not repurpose group media into globally visible avatars.

Checks: more than 100 entries, timestamp ties, deletion of an earlier loaded entry, folder/author isolation, rejected fetch preserving retry, lazy media, browser navigation and build. Complete avatar storage authorization in a separate migration with database tests before adding uploads.
