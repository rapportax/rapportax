---
name: semantic-commit-ko
description: Craft and execute semantic (Conventional Commits) git commits in Korean with sentence endings and context-appropriate emoji. Use when the user asks to write, refine, or run commit messages, or when a commit is needed after code changes. Triggers include 커밋, 커밋 메시지, 시맨틱 커밋, Conventional Commits.
---

# Semantic Commit (Korean)

## Overview

Generate Korean semantic commit messages with polite sentence endings and optional emoji, then commit safely.

## Workflow

1. Inspect changes with `git status -sb` and `git diff` (and `git diff --staged` if needed).
2. Decide if changes should be split into multiple commits; propose splits when logical boundaries exist.
3. Select the semantic type and optional scope based on the change intent.
4. Write a Korean summary ending with a sentence ending (e.g., "합니다", "했습니다", "됩니다").
5. Recommend an emoji that matches the change context.
6. If a `pnpm check` script exists for the relevant package, run it and fix failures (see procedure below).
7. If committing, confirm the final message and run `git commit -m "<message>"`.

## pnpm check Procedure

Run when a `pnpm` project includes a `check` script (e.g., `package.json` has `"check"`).

1. Identify the correct package directory by locating `package.json` that defines a `"check"` script.
2. If the repo root has no `package.json`, run in the target folder: `pnpm -C <dir> check`.
3. If there are multiple packages, select the one that contains the changes you are committing.
4. Run `pnpm check` in that directory.
5. If it fails, read the error output and fix only the files involved.
6. Re-run `pnpm check` until it passes.
7. If you cannot fix the errors, summarize the failures and stop before committing.

## Commit Message Format

Use the Conventional Commits style:

```
<emoji?> <type>(<scope>): <summary>
```

Rules:
- `summary` must be Korean and end with a sentence ending (종결어미).
- Keep summary short and action-oriented.
- Omit the period at the end of the summary.
- If scope is unclear, omit it instead of guessing.

Optional body:

```

- 변경 사항 1
- 변경 사항 2
```

Breaking changes:

```
BREAKING CHANGE: <설명합니다>
```

## Types and Emoji Guide

- `feat`: ✨ 새 기능
- `fix`: 🐛 버그 수정
- `docs`: 📝 문서
- `style`: 🎨 포맷/스타일
- `refactor`: ♻️ 리팩터링
- `perf`: ⚡️ 성능 개선
- `test`: ✅ 테스트
- `build`: 🏗️ 빌드/도구
- `ci`: 👷 CI
- `chore`: 🧹 잡무/기타
- `revert`: ⏪ 되돌림

Emoji is recommended but optional. Place it before the type.

## Examples

```
✨ feat(auth): 로그인 리다이렉트를 추가합니다
🐛 fix(api): 응답 파싱 오류를 수정합니다
📝 docs: 환경 변수 설정을 문서화합니다
♻️ refactor: 메시지 처리 로직을 정리합니다
```
