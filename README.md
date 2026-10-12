# gs

Switch between Git + SSH identities (e.g. `personal` / `work`) with one command.

`gs` sets `user.name` / `user.email` and points the default `Host github.com`
entry in `~/.ssh/config` at the selected account's SSH key. Accounts are stored
in `~/.git-accounts.json`.

> [!IMPORTANT]
> `gs` hanya bekerja lewat jalur SSH, bukan HTTPS. Pastikan remote memakai
> format SSH (`git@github.com:...`), bukan `https://github.com/...`.

## Requirements

- macOS or Linux
- `zsh`, `node`, `git`, `ssh-keygen`

## Install

```bash
git clone <repo-url> gs
cd gs
bash install.sh
```

This symlinks `gs` and `git-acc` (an alias for the same script) into
`~/.local/bin`. To install somewhere else:

```bash
PREFIX=/usr/local/bin bash install.sh
```

If the install directory is not in your `PATH`, add it:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

Verify:

```bash
gs help
```

Because the install is a symlink, keep the cloned folder in place; `git pull`
updates the command.

## Usage

```bash
gs                      # list accounts (same as: gs l / gs ls / gs list)
gs c                    # show current git + ssh identity (gs cur / gs me)
gs a                    # add an account (interactive)
gs work                 # switch globally, by name
gs 1                    # switch globally, by list number
gs s work --local       # switch only for the current repository
gs r work               # remove an account
gs help
```

### Adding an account

`gs a` asks for an account name, Git name, Git email, GitHub username and SSH
key path (default `~/.ssh/id_ed25519_<name>`; `personal` uses
`~/.ssh/id_ed25519`). It then:

1. Saves the account to `~/.git-accounts.json`.
2. Generates the SSH key if it does not exist and prints the public key —
   add it at <https://github.com/settings/keys>.
3. Appends a `Host github.com-<name>` block to `~/.ssh/config`.

### Switching

`gs <name>` updates the global Git identity and rewrites the `IdentityFile` of
the default `Host github.com` block, so plain `git@github.com:...` remotes use
the selected key.

`--local` only changes the Git identity of the current repository. The SSH
default is still switched globally. To pin a repository to one account
regardless of the active one, use the per-account host alias in its remote:

```bash
git remote set-url origin git@github.com-work:org/repo.git
```

## Files

| Path | Purpose |
| --- | --- |
| `~/.git-accounts.json` | Account list and last used account |
| `~/.ssh/config` | `Host github.com` and `Host github.com-<name>` blocks |

Config format:

```json
{
  "accounts": [
    {
      "name": "work",
      "git_name": "Jane Doe",
      "git_email": "jane@company.com",
      "gh_username": "jane-work",
      "ssh_key": "~/.ssh/id_ed25519_work"
    }
  ],
  "last_used": "work"
}
```

## Uninstall

```bash
rm ~/.local/bin/gs ~/.local/bin/git-acc
```

`~/.git-accounts.json`, your SSH keys and `~/.ssh/config` are left untouched.
