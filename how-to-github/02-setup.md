
# Setting Up Your GitHub Account and Environment

Before you start using GitHub, you need to set up your GitHub account and configure your local development environment. This tutorial will walk you through the necessary steps.

## Learning Objectives

- Create a GitHub account.
- Install Git on your local machine.
- Configure Git with your name and email.

## Creating a GitHub Account

1. Open your web browser and go to [github.com](https://github.com).
2. Click on "Sign Up" and follow the instructions to create your account.

## Installing Git

Git is the version control system that GitHub is built upon. To install Git:

- On Windows: Download and run the installer from [git-scm.com](https://git-scm.com/download/win).
- On macOS: Install Git using [Homebrew](https://brew.sh) with the command: `brew install git`.
- On Linux: Use your package manager to install Git, e.g., `sudo apt-get install git`.

## Configuring Git

After installing Git, configure it with your name and email:

```bash
git config --global user.name "Your Name"
git config --global user.email "your@example.com"
```
## Verifying Setup

To verify that Git is correctly installed and configured, run the following commands:
```bash
git --version
git config --global --list
```
Congratulations, you've successfully set up your GitHub account and configured Git on your local machine!

[Next: Basic Git Commands](https://chat.openai.com/03-basic-commands.md)
