# OpenPlan file format (`.openplan`)

OpenPlan saves project files as JSON with the `.openplan` extension.

## Project fields

| Field | Type | Default | Description |
|---|---|---|---|
| `version` | number | `2` | File format version |
| `name` | string | `"Untitled project"` | Project name |
| `organization` | string | `""` | Organization |
| `manager` | string | `""` | Project manager |
| `status` | string | `"Draft"` | Project status |
| `issueDate` | string | Today's date | Issue date |
| `start` | string | Today's date | Project start date |
| `statusDate` | string | `""` | Reporting date |
| `budget` | number | `0` | Project budget |
| `currency` | string | `"Rs."` | Display currency |
| `currencyCode` | string | `""` | ISO currency code |
| `hoursPerDay` | number | `8` | Working hours per day |
| `workDays` | number[] | `[1,2,3,4,5]` | Working weekdays |
| `holidays` | string[] | `[]` | Holiday dates |
| `customFields` | CustomField[] | `[]` | Custom field definitions |
| `baseline` | object or `null` | `null` | Saved baseline |
| `nextUid` | number | `1` | Next available identifier |
| `tasks` | Task[] | `[]` | Project tasks |
| `resources` | Resource[] | `[]` | Project resources |

## Task fields

| Field | Type | Default | Description |
|---|---|---|---|
| `uid` | number | Generated | Unique identifier |
| `name` | string | `""` | Task name |
| `level` | number | `1` | Outline level |
| `duration` | number | `1` | Duration in working days |
| `milestone` | boolean | `false` | Milestone flag |
| `percent` | number | `0` | Completion percentage |
| `notes` | string | `""` | Task notes |
| `preds` | Link[] | `[]` | Dependencies |
| `assignments` | Assignment[] | `[]` | Resource assignments |
| `constraint` | string | `"ASAP"` | Scheduling constraint |
| `constraintDate` | string | `""` | Constraint date |
| `deadline` | string | `""` | Deadline |
| `type` | string | `"FixedUnits"` | Scheduling type |
| `effortDriven` | boolean | `true` | Effort-driven scheduling |
| `fixedCost` | number | `0` | Fixed cost |
| `actualStart` | string | `""` | Actual start |
| `actualFinish` | string | `""` | Actual finish |
| `splits` | Split[] | `[]` | Task split segments |
| `levelDelay` | number | `0` | Leveling delay |
| `priority` | number | `500` | Scheduling priority |
| `custom` | object | `{}` | Custom task values |
| `comments` | Comment[] | `[]` | Task comments |

## Dependencies (Link)

| Field | Type | Description |
|---|---|---|
| `uid` | number | Predecessor task UID |
| `type` | string | `FS`, `SS`, `FF`, or `SF` |
| `lag` | number | Lag in working days |

## Assignments

| Field | Type | Description |
|---|---|---|
| `res` | number | Resource UID |
| `units` | number | Assigned units |

## Splits

| Field | Type | Description |
|---|---|---|
| `at` | number | Split position in working days |
| `gap` | number | Gap duration in working days |

## Comments

| Field | Type | Description |
|---|---|---|
| `id` | string | Comment identifier |
| `by` | string | Comment author |
| `at` | string | Comment timestamp |
| `text` | string | Comment text |

## Resource fields

| Field | Type | Default | Description |
|---|---|---|---|
| `uid` | number | Generated | Unique resource identifier |
| `name` | string | `""` | Resource name |
| `initials` | string | `""` | Resource initials |
| `role` | string | `""` | Resource role |
| `type` | string | `"Full-time"` | Resource type |
| `kind` | string | `"Work"` | `Work`, `Material`, or `Cost` |
| `materialLabel` | string | `""` | Material unit label |
| `maxUnits` | number | `100` | Maximum availability (%) |
| `rate` | number | `0` | Standard rate |
| `costPerUse` | number | `0` | Cost per use |
| `rates` | RateEntry[] | `[]` | Rate changes |
| `workDays` | number[] | `[1,2,3,4,5]` | Working weekdays |
| `vacations` | string[] | `[]` | Unavailable dates |
| `reportsTo` | number or `null` | `null` | Reporting resource UID |

## Rate entry

| Field | Type | Description |
|---|---|---|
| `from` | string | Effective date |
| `rate` | number | Rate amount |

## Custom fields

| Field | Type | Description |
|---|---|---|
| `id` | string | Field identifier |
| `name` | string | Display name |
| `type` | string | `text` or `number` |

## Baseline

The baseline is `null` until saved. A saved baseline contains a `savedAt` timestamp and a `tasks` object keyed by task UID. Each task entry stores baseline start, finish, duration, cost, and work values.

## Example

\`\`\`json
{
  "version": 2,
  "name": "Website launch",
  "organization": "",
  "manager": "",
  "status": "Draft",
  "issueDate": "2026-11-21",
  "start": "2026-11-23",
  "statusDate": "",
  "budget": 5000,
  "currency": "Rs.",
  "currencyCode": "",
  "hoursPerDay": 8,
  "workDays": [1, 2, 3, 4, 5],
  "holidays": [],
  "customFields": [],
  "baseline": null,
  "nextUid": 2,
  "tasks": [],
  "resources": []
}
\`\`\`

Dates are stored as strings, commonly in ISO format (`YYYY-MM-DD`). Task and resource UIDs are numeric and unique within a project. When loading files, missing fields are filled with defaults and invalid values are normalized.
</WritingBlock}

The `.openplan` file format is documented in the [file format reference](docs/file-format.md).
