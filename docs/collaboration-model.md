# Collaboration model — continuous server-authoritative commit

> BIM AI is the first BIM authoring environment with continuous server-authoritative collaboration; there is no central file to synchronize.

This note explains how multi-user editing works in BIM AI and why the rituals a Revit user expects ("Synchronize with Central", "Reload Latest", workset locking) do not exist here. The short version: every command is ordered and committed by the server before clients see it. There is no client-side branch to merge back, so there is nothing to synchronize.

## How a session looks from a client

1. A client opens a model. The server replies with the current snapshot at revision `r`.
2. The client opens a websocket on `/ws/<modelId>`.
3. The user issues a command — drag a wall, change a level, place a door. The client posts it to `POST /api/models/:id/commands`.
4. The server validates the command (constraints, geometry, hosting, permissions), assigns it the next revision `r+1`, persists it to the command log, and broadcasts the resulting delta + new revision over the websocket.
5. Every connected client receives the delta in order and applies it. The model state on every client converges to the server's state at revision `r+1`.

This is true for every command, including the ones an agent issues over the same HTTP API. Agents and humans share a single ordered command log; there is no separate "agent branch".

## Why "Synchronize with Central" is unnecessary

In Revit the central file is the authoritative copy and each contributor edits a local copy that is reconciled at sync time. Several rituals exist to manage that gap: Synchronize with Central, Reload Latest, Save to Central, Relinquish, workset checkout. They all exist because the local copy can drift from the central copy between syncs.

In BIM AI there is no local copy. The canonical state *is* the server's command log, and clients receive every commit as it happens. The gap that those rituals close does not exist:

| Revit ritual                   | BIM AI equivalent                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Synchronize with Central       | No-op. Every command is already on the server before any client sees it.                                              |
| Reload Latest                  | No-op. Websocket pushes every commit on receipt; latest is always live.                                               |
| Save to Central                | Implicit. `POST /commands` is the save.                                                                               |
| Workset checkout / Editable    | Per-command constraint check. The server rejects an edit if it would conflict with model state at commit time.        |
| Relinquish all mine            | No-op. There is nothing held to relinquish.                                                                           |
| Detach from central            | `POST /api/projects/:projectId/models` with the existing snapshot — produces a new model with its own command log.    |

## Conflict resolution happens at commit time

Two users editing the same wall at the same time cannot produce a "merge conflict" because their edits are serialized by the server. The first command commits at revision `r+1`; the second sees the post-`r+1` state and either still applies cleanly or is rejected by a constraint (e.g. the wall it targeted no longer exists, or the new geometry breaks a hosting relationship). Rejection is per-command, not per-session; there is no batch reconciliation step.

This is strictly stronger than Revit's central-file model:

- **No silent overrides.** Revit's "last sync wins" can drop edits a co-author already made if you sync without reloading. Here, every commit lands on top of the latest revision; there is nothing to drop.
- **No worksets to manage.** Permissioning is per-element, not per-checkout. Two users can edit adjacent walls without one of them taking ownership of the wall.
- **No reconciliation backlog.** When a user reconnects after a network drop, the client replays the missed deltas from their last revision and they're caught up; no Synchronize step.

## Per-user undo coexists with the shared model

Each user has their own undo stack. `Undo` issues a compensating command on the user's most recent commit that no other user has built on; if a later user has built on it, the undo either rebases (when safe) or is rejected with `undo_blocked_by_dependency`. The shared model state is always the linear command log; per-user undo is a view onto "the most recent thing *I* did that's still safe to reverse", not a parallel branch.

## What this does *not* solve

- **Offline editing.** A client without a websocket connection cannot author commands; the model is collaborative-online-only.
- **Long-running detached work.** If a user wants to spike on a variant without affecting peers, they create a separate model from a snapshot and merge later via a bundle export. There is no built-in "branch" within a single model.
- **Federated cross-database links.** Linked models (FED-01..FED-04) live in the same database; cross-database federation is on the roadmap.

## What a Revit user should know on day one

- There is no Synchronize button. Hitting `Ctrl-S` does nothing; there is nothing to save.
- There is no central file. The server *is* the central file, and every command is the sync.
- There are no worksets. If two of you edit the same wall, one of the edits will commit and the other will be rejected; you'll see the conflict immediately, not at sync time.
- Undo is yours alone. Undoing your own work won't reverse anyone else's.

For the API surface, see `packages/cli/cli.mjs` (`bim-ai watch`, `bim-ai apply`, `bim-ai apply-bundle`) and the websocket protocol at `/ws/<modelId>`.
