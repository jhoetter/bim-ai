# Core data model

## Hierarchy

```
Project (1) ──┬── Model (many)
              └── Issues, comments (scoped to model)
Model ──┬── Level (many)
        ├── Room (many, references level_id)
        ├── Wall (many, references level_id, optional linked rooms)
        ├── Door (many, references wall_id, level_id inferred from wall)
        └── Viewpoint (many)
```

## Identifiers

- `ulid`-style IDs (string); server generates on create.
- `rev` increments on Model when any element graph changes.

## Element base

```yaml
kind: Level | Wall | Door | Room
id: string
name: string
created_at: iso8601
updated_at: iso8601
```

## Types (v1)

### Level

- `elevation_mm`: number — base Z in millimeters.

### Wall

- `level_id`: string
- `start`: { x, y } mm in plan at level datum
- `end`: { x, y }
- `thickness_mm`: number
- `height_mm`: number
- `material` (optional): string

### Door

- `wall_id`: string
- `along_t`: float 0..1 parameter along wall centerline segment
- `width_mm`: number
- `swing_deg`: angle (0 = default)

### Room

- `level_id`: string
- `outline_mm`: array of { x, y } closed polygon vertices (same plane).

### Issue

- `title`, `status`: open | in_progress | done
- `element_ids`: string[]
- `viewpoint_id`: optional string
- `assignee_placeholder`: optional string (demo)

### Viewpoint

- `camera`: `{ position: {x,y,z}, target: {x,y,z}, up:{x,y,z} }`
- `mode`: "plan_2d" | "orbit_3d"

### ConstraintViolation

- `rule_id`: string (stable rule codename)
- `severity`: "error" | "warning"
- `message`: string
- `element_ids`: string[]

## Persistence

PostgreSQL rows: `projects`, `models`, JSONB columns `elements_payload` partitioned by kind or single `elements` table with `(model_id, id, kind, data)`. V1 implements `elements` as JSON blobs keyed by `id` inside `models.state` JSON for simplicity, or normalized table—implementation chooses simplest with migration path.

## Document operation (Op)

Applied atomically server-side:

```typescript
interface OpEnvelope {
  op_id: string;
  model_id: string;
  seq: number; // assigned by server
  client_id?: string;
  command: Command; // typed union
}
```

Server returns `applied | rejected` plus `violations[]` snapshot after apply.
