# `config/` — Tool configuration files

Configuration files that static analyzers and external services need at
build/analysis time. Grouped here (instead of the project root) to keep
the top level focused on the application itself.

## Files

| File                        | Consumed by                           | Role                                                                                         |
| --------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| `sonar-project.properties`  | SonarCloud (Maven/Sonar scanner)      | Project key, organization, source paths, JS/TS language settings, coverage file locations.   |
| `README.md`                 | (humans)                              | This file.                                                                                  |

## How SonarCloud finds this file

The GitLab CI `sonar-analysis` job runs the Sonar scanner which walks up
from the current directory looking for `sonar-project.properties`.
Historically the file had to be at the project root; modern scanners
(since ~Scanner CLI 5.x) also accept `-Dsonar.projectBaseDir=config` or
the file passed via `-Dproject.settings=config/sonar-project.properties`.

If SonarCloud stops picking this up after the move, either:

1. Add to `.gitlab-ci.yml` `sonar-analysis:script:`:
   ```
   -Dproject.settings=config/sonar-project.properties
   ```
2. Or symlink: `ln -s config/sonar-project.properties sonar-project.properties`
   at repo root (crude but works).

## Related

- `.gitlab-ci.yml` — `sonar-analysis` job that runs the scanner.
- `CLAUDE.md` — notes on SonarCloud org/project key setup.
