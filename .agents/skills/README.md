# Google Stitch Agent Skills

This directory vendors the Google Stitch Agent Skills for project-local discovery by coding agents.

- Upstream: [google-labs-code/stitch-skills](https://github.com/google-labs-code/stitch-skills)
- Source revision: [62fdcd679747aca0792e5dd6591b10ddfad56825](https://github.com/google-labs-code/stitch-skills/tree/62fdcd679747aca0792e5dd6591b10ddfad56825)
- Installed skills: 16, across Stitch Design, Stitch Build, and Stitch Utilities.
- License and upstream notices: see each upstream skill file and repository.

The two skills whose upstream names use the plugin namespace `stitch::` have their frontmatter names normalized to their kebab-case directory names, as required for project-local Agent Skills discovery. Skill guidance and supporting assets otherwise follow the pinned upstream revision.

## Prerequisite

These skills need the Stitch MCP server configured in the coding agent's runtime, including the required Stitch credentials. Follow Google's [Stitch MCP setup](https://stitch.withgoogle.com/docs/mcp/setup/). Adding these files does not configure MCP credentials.

## Updating

Review the upstream changes, update the pinned revision and vendored skill files together, and preserve upstream notices. Avoid running the upstream scripts unless the task specifically requires them.
