# Interactive Rebasing

Interactive rebasing is a powerful technique for manipulating commit history. In this tutorial, you'll learn how to use interactive rebase to restructure and clean up your commit history.

## Learning Objectives

- Understand the purpose of interactive rebasing.
- Learn how to initiate an interactive rebase.
- Explore common actions during interactive rebase.
- Master the process of using interactive rebase for a cleaner history.

## What is Interactive Rebasing?

Interactive rebasing allows you to rewrite commit history by modifying, reordering, or combining commits.

## Initiating Interactive Rebase

1. **Start Interactive Rebase**: Use `git rebase -i <commit>` to start interactive rebasing.

2. **Choose Commits**: In the interactive rebase editor, choose which commits to modify.

## Common Actions in Interactive Rebase

- **Reordering Commits**: Change the order of commits to create a logical history.
- **Squashing Commits**: Combine multiple commits into a single commit.
- **Editing Commits**: Modify commit messages or the content of individual commits.

## Cleaning Up Commit History

- **Fixing Mistakes**: Correct typos, code errors, or incorrect commit messages.
- **Squash and Merge**: Combine feature-related commits into a single, coherent commit.

## Collaborative Interactive Rebase

- **Before Pushing**: If you've shared your commits, avoid interactive rebasing. It rewrites history and can cause conflicts for collaborators.

## Next Steps

You've learned how to use interactive rebasing for a cleaner commit history. In the next tutorial, we'll explore different merge strategies.

[Next: Different Merge Strategies](04-merge-strategies.md)
