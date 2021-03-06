# git-switch

git-switch is a simple CLI for managing multiple git profiles.

## How it works

`git-switch` stores each git profile in its own directory. Each profile consists of an SSH key pair and a JSON file with git configuration details.

Switching between profiles will update your global git config to use the data in the JSON file -- local git configs *will* interfere -- and creates a symbolic link back to the profile's SSH key pair. This allows you to switch between multiple profiles without losing your SSH credentials.

## Usage

| command             | purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `git switch`        | Switches profiles or adds a profile if none exist     |
| `git switch add`    | Adds a profile                                        |
| `git switch key`    | Copy's the current profile's SSH key to the clipboard |
| `git switch list`   | Lists all available profiles                          |
| `git switch remove` | Removes a profile                                     |
| `git switch reset`  | Resets git and SSH settings to the current profile    |
