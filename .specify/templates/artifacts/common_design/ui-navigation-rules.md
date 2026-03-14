# Shared UI Navigation Rules

- common_design_id: CD-UI-002
- kind: ui
- artifact_type: navigation_rules

## Shared Purpose
<why these navigation rules are shared across multiple features>

## Navigation Map

```mermaid
flowchart LR
    SCR001["SCR-001 <screen name>"] --> SCR002["SCR-002 <screen name>"]
    SCR002 --> SCR001
    SCR002 --> ERR401["SCR-901 Unauthorized"]
```

## Rules
- list_to_detail: <shared rule>
- detail_to_list: <shared rule>
- save_complete: <shared rule>
- unauthorized: <shared rule>
- session_timeout: <shared rule>
- fatal_error: <shared rule>

## Exceptions
- <allowed exception or `none`>

## Downstream Usage
- <specific design or brief>
