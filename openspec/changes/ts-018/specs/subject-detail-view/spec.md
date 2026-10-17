# Spec Delta

## ADDED Requirements

### Requirement: Detail header total task count

The detail view header SHALL show the same total label as the overview card
(« 0 tâche au total », « 1 tâche au total », « N tâches au total ») for the
subject's top-level tasks, beside the existing unfinished-step count. It MUST be
a text node, MUST exclude substeps, MUST include completed tasks and MUST NOT
replace, rename or change the pending count or the navigation.

#### Scenario: Total shown in the detail header

- **WHEN** the detail view of a subject with top-level tasks is open
- **THEN** its header shows the total label in addition to the pending count

#### Scenario: Detail total matches the overview

- **WHEN** the same subject is shown in the overview and in the detail view
- **THEN** both headers show the same total

#### Scenario: Pending count is preserved

- **WHEN** the detail header renders
- **THEN** the existing unfinished-step count and its wording are unchanged

#### Scenario: No write or navigation change

- **WHEN** the detail view is opened, closed or switched without a business action
- **THEN** the document, localStorage and the JSON export are unchanged and the route behavior is unchanged
