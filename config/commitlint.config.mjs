// =============================================================================
// commitlint config — Conventional Commits reference.
//
// Enforcement is a pure-bash regex in lefthook.yml (commit-msg →
// conventional-commits). This file documents intent.
//
// Accepted types:
//   feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert
// Subject ≤ 72 chars, no trailing period.
// Optional scope in parens. Optional `!` marks a breaking change.
//
// Powers bin/ship/changelog.sh categorisation (feat/fix/perf → sections).
// =============================================================================

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
    'header-max-length': [2, 'always', 72],
    'subject-case': [2, 'always', ['lower-case', 'sentence-case']],
    'subject-full-stop': [2, 'never', '.'],
    'body-max-line-length': [1, 'always', 100],
  },
};
