# Working with Git Submodules

Git submodules allow you to include other repositories within your own repository. In this tutorial, you'll learn how to add, update, and manage Git submodules.

## Learning Objectives

- Understand the concept of Git submodules.
- Learn how to add and initialize submodules.
- Explore updating and syncing submodules.
- Master the process of collaborating with submodules.

## What are Git Submodules?

Git submodules are repositories embedded within another repository. They allow you to manage and track external code as part of your project.

## Adding a Submodule

1. **Add Submodule**: Use `git submodule add <repository-url> <destination-path>` to add a submodule.

2. **Initialize and Update**: After adding, use `git submodule update --init` to initialize and clone the submodule.

## Updating Submodules

- **Updating Submodules**: Use `git submodule update --remote` to fetch and update the latest changes in submodules.

## Collaborating with Submodules

- **Cloning with Submodules**: When cloning a repository with submodules, use `git clone --recursive`.

- **Pull Requests and Submodules**: Contributors should update submodules before creating a pull request.

## Handling Submodule Changes

- **Committing Submodule Changes**: When you commit changes in a submodule, update the main repository to track the new submodule commit.

## Next Steps

You've learned how to work with Git submodules. In the next tutorial, we'll explore interactive rebasing.

[Next: Interactive Rebasing](03-rebase.md)
