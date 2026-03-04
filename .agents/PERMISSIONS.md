# Agent Permissions & Preferences

This file documents explicit permissions and tool-calling preferences granted to AI agents working on the Axiom Zero project. 

## 1. Automated Command Execution

### `Get-ChildItem -Path` (SafeToAutoRun: true)
The developer has granted permission to always auto-run file-searching and project-discovery commands using the `run_command` tool when the command begins with or is exclusively:
- `Get-ChildItem -Path`
- `dir` (alias)
- `ls` (alias)
- `wc` (word count/stats)
- `uglifyjs` & `npx uglifyjs` (minification/build tasks)
- `python3` (data processing/scripting)
- `node -e` (one-off JS execution)
- `find` & `grep` (complex project-wide discovery)

**Reasoning**: These commands are essential for autonomous project analysis, build verification, and data processing. The developer has explicitly whitelisted these categories in legacy settings.

### Workflow Integration (`// turbo-all`)
Agents are encouraged to use and create files in `.agents/workflows/` using the `// turbo-all` annotation at the top of the file to streamline repetitive development tasks.

---
*Created on: 2026-03-04*
