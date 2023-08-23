# The Cherry-Pick Technique

Cherry-picking allows you to select specific commits from one branch and apply them to another. In this tutorial, you'll learn how to use the cherry-pick technique effectively.

## Learning Objectives

- Understand the concept of cherry-picking.
- Learn how to cherry-pick individual commits.
- Explore scenarios for using cherry-pick.
- Master the process of resolving conflicts during cherry-pick.

## What is Cherry-Picking?

Cherry-picking involves choosing specific commits and applying them to a different branch.

## Cherry-Picking Individual Commits

1. **Identify Commits**: Find the commit hashes you want to cherry-pick from another branch.

2. **Cherry-Pick**: Use `git cherry-pick <commit-hash>` to apply the selected commit to the current branch.

## Scenarios for Cherry-Picking

- **Bug Fixes**: Apply a bug fix commit from a release branch to the main branch.
- **Feature Porting**: Copy a feature-related commit from a feature branch to another branch.
- **Conflict Resolution**: Resolve conflicts in the cherry-picked commit.

## Resolving Conflicts

- **Conflicts**: If the cherry-picked commit conflicts with changes in the target branch, resolve them manually.
- **Committing**: After resolving conflicts, commit the changes.

## Collaborative Cherry-Picking

- **Shared Commits**: Cherry-pick only if the changes are relevant to the target branch.
- **Conflicts**: Collaborators should be aware of potential conflicts.

## Next Steps

You've learned how to use the cherry-pick technique. In the next tutorial, we'll explore GitHub Pages for hosting websites.

[Next: Hosting Websites with GitHub Pages](10-github-pages.md)
