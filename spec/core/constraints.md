# Constraint engine (V1)

## Philosophy

Constraints are **continuously evaluated** after each successful command application. There is no separate “Run clash detection” action for the core rules—results appear in the violations panel.

## Rule catalog (V1)

| rule_id            | Severity | Description                                                            |
| ------------------ | -------- | ---------------------------------------------------------------------- |
| `wall_zero_length` | error    | Wall start == end                                                      |
| `wall_overlap`     | error    | Two walls on same level overlap in plan (buffer by half thickness)     |
| `door_off_wall`    | error    | Door `alongT` not in (0,1) or door width exceeds wall length           |
| `door_not_on_wall` | error    | Door references missing wall                                           |
| `room_no_door`     | warning  | Room bounding box has no door center within threshold (demo heuristic) |
| `duplicate_id`     | error    | Internal integrity (should not surface if server-only IDs)             |

## Evaluation order

1. Structural validation (references exist, parameters in range).
2. Spatial rules (wall-wall intersection in 2D).
3. Hosted rules (doors).
4. Room heuristics.

## Performance (V1)

O(n²) wall pairwise check acceptable for seed sizes (\<200 walls). Future: spatial hash / R-tree.

## Conflict with Op

- If applying a command would leave model in state with **error** violations **introduced by that command**, server **rejects** and returns previous state + violations from dry-run.
- Alternatively: apply then rollback—v1 uses dry-run apply on shadow copy.

## AI

AI may read violation list and propose fix commands; must not bypass validation.
