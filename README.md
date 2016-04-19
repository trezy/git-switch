# git-switch

`git-switch` is a simple CLI for managing multiple git profiles.

## How it works

`git-switch` stores each git profile in its own directory. Each profile consists of an SSH key pair and a JSON file with git configuration details.

Switching between profiles will update your global git config to use the data in the JSON file -- local git configs *will* interfere with this -- and creates a symbolic link back to the SSH key pair. This allows you to switch between multiple profiles without fear of losing your SSH credentials.

## Usage

| command             | purpose                                     |
| ------------------- | ------------------------------------------- |
| `git switch`        | Switches profiles                           |
| `git switch add`    | Adds a profile                              |
| `git switch key`    | Copy's the current SSH key to the clipboard |
| `git switch list`   | Lists all available profiles                |
| `git switch remove` | Removes a profile                           |
