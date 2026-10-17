# ThreadStep canonical-spec quality gate (runner-local OPSX sync instructions)

During this OPSX semantic sync, preserve every requirement and scenario from
the change, including existing unrelated canonical behavior. Keep requirements
atomic. OpenSpec 1.14.1 strict validation rejects requirements whose prose is
longer than 500 characters. Target at most 400 characters of prose per
`### Requirement:` block (excluding its scenarios); split a long requirement
into distinct requirements if each is independently normative, and move
examples, edge cases and interaction details into explicit `#### Scenario:`
blocks. Do NOT delete normative constraints or relax acceptance just to pass.
Read the existing canonical spec before editing it and do not edit any path
outside `openspec/specs/`. After sync, run
`openspec validate --all --strict --no-interactive`, correct any failure in
canonical specs before completing this command, and report unresolved errors.
The workflow independently repeats strict validation BEFORE archiving.
