# Branching Strategies

Branching is a powerful feature in Git that allows you to work on different aspects of your project simultaneously. In this tutorial, you'll explore branching strategies and how to manage branches effectively.

## Learning Objectives

- Understand the concept of branches in Git.
- Learn different branching strategies, such as feature branches and release branches.
- Master commands for creating, switching, and merging branches.

## What are Branches?

Branches in Git are lightweight pointers to specific commits. They allow you to work on separate lines of development without affecting the main codebase.

## Common Branching Strategies

1. **Feature Branches**: Create branches for specific features or tasks. Merge them back into the main branch when complete.
2. **Release Branches**: Create branches for preparing releases. Perform bug fixes and testing before merging into the main branch.
3. **Hotfix Branches**: Create branches to fix critical issues in the main branch. Merge changes back into both main and active feature branches.

## Branching Commands

- `git branch`: List all branches in the repository.
- `git branch <branch-name>`: Create a new branch.
- `git checkout <branch-name>`: Switch to a different branch.
- `git merge <branch-name>`: Merge changes from one branch into another.
- `git rebase <branch-name>`: Apply changes from one branch on top of another.

## Resolving Conflicts

When merging or rebasing, conflicts may arise when changes overlap. Use `git status`, `git diff`, and manual editing to resolve conflicts.

## Next Steps

You've learned about branching strategies and how to manage branches effectively. In the next tutorial, we'll dive into pull requests for collaborative development.

[Next: Collaborative Development with Pull Requests](05-pull-requests.md)
