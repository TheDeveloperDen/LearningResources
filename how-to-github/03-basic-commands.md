# Basic Git Commands

Git commands form the foundation of version control with Git. In this tutorial, you'll learn essential Git commands for managing your code changes.

## Learning Objectives

- Understand the basic Git workflow.
- Learn how to initialize a Git repository.
- Master commands for staging and committing changes.
- Explore commands to review repository history and undo changes.

## Basic Workflow

1. **Initialize a Repository**: Create a new directory and run `git init` to start tracking changes.

2. **Stage Changes**: Use `git add <filename>` to stage changes for commit.

3. **Commit Changes**: Use `git commit -m "Your commit message"` to commit staged changes.

## Common Commands

- `git status`: Check the status of your repository and see which files are staged or modified.
- `git log`: View the commit history with details like author, date, and commit message.
- `git diff`: See the differences between working directory and staged changes.
- `git reset`: Unstage changes or move the HEAD to a specific commit.

## Undoing Changes

- `git checkout <commit>`: Switch to a specific commit, detaching HEAD from the current branch.
- `git revert <commit>`: Create a new commit that undoes changes from a specific commit.
- `git reset --hard <commit>`: Discard changes and move the current branch to a specific commit.

## Next Steps

You've now learned the basics of working with Git. In the next tutorial, we'll explore branching strategies.

[Next: Branching Strategies](04-branches.md)
