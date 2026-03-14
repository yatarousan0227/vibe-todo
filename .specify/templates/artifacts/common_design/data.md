# Shared Data Design

- common_design_id: CD-DATA-001
- kind: data

## Shared Purpose
<why this entity model is shared across multiple features>

## Entity Relationship Snapshot

```mermaid
erDiagram
    CD_DATA_001_ENTITY {
        string <field_name>
    }
```

## Shared Entities

### ENT-001 <entity name>
- purpose: <entity purpose>
- fields:
  - name: <field name>
    type: string
    required: true
- invariants:
  - <shared data rule>

## Downstream Usage
- <specific design or brief>
