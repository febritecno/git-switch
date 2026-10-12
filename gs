#!/bin/zsh
# gs - switch git + ssh via ~/.git-accounts.json
# usage: gs list | current | switch <name> [--global|--local] | add | remove <name>

CONFIG="$HOME/.git-accounts.json"
SSH_CONFIG="$HOME/.ssh/config"

# ensure jq or node available - use node
if [[ ! -f "$CONFIG" ]]; then
  echo '{"accounts":[],"last_used":""}' > "$CONFIG"
fi

cmd="$1"
arg="$2"
flag="$3"

list_accounts() {
  node -e '
    const fs=require("fs");
    const cfg=JSON.parse(fs.readFileSync(process.env.HOME+"/.git-accounts.json","utf8"));
    if(cfg.accounts.length===0){console.log("No accounts. Add with: gs add");process.exit(0)}
    console.log("Accounts:");
    cfg.accounts.forEach((a,i)=>{
      const cur = cfg.last_used===a.name ? " *active" : "";
      console.log(`[${i+1}] ${a.name}${cur}`);
      console.log(`    Git: ${a.git_name} <${a.git_email}>`);
      console.log(`    GH:  ${a.gh_username}`);
      console.log(`    SSH: ${a.ssh_key || "~/.ssh/id_ed25519"+(a.name==="personal"?"":"_"+a.name)}`);
    });
  '
}

current_status() {
  echo "Current git --global:"
  echo "  $(git config --global user.name) <$(git config --global user.email)>"
  if git rev-parse --is-inside-work-tree &>/dev/null; then
    echo "Current git --local ($(pwd)):"
    echo "  $(git config user.name) <$(git config user.email)>"
  fi
  echo "Current SSH default (Host github.com):"
  grep -A2 "^Host github.com$" "$SSH_CONFIG" 2>/dev/null | head -n 5
  echo "Active account (last_used): $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.env.HOME+"/.git-accounts.json","utf8")).last_used)')"
}

switch_account() {
  local name="$1"
  local scope="$2" # --global default, --local if specified
  if [[ -z "$name" ]]; then echo "Usage: gs switch <account> [--global|--local]"; return 1; fi
  if [[ "$scope" != "--local" ]]; then scope="--global"; fi

  node -e "
    const fs=require('fs');
    const os=require('os');
    const path=require('path');
    const cfgPath=path.join(os.homedir(),'.git-accounts.json');
    const cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));
    let acc=cfg.accounts.find(a=>a.name==='$name');
    if(!acc && /^\d+$/.test('$name')){ const idx=parseInt('$name',10)-1; acc=cfg.accounts[idx]; }
    if(!acc){console.error('Account not found: $name');process.exit(1)}
    const {execSync}=require('child_process');
    // git config
    const sc='$scope';
    execSync(\`git config \${sc} user.name \"\${acc.git_name}\"\`);
    execSync(\`git config \${sc} user.email \"\${acc.git_email}\"\`);
    // update last_used
    cfg.last_used=acc.name;
    fs.writeFileSync(cfgPath, JSON.stringify(cfg,null,2));
    // ssh - update default Host github.com IdentityFile
    let sshKey = acc.ssh_key || ('~/.ssh/id_ed25519' + (acc.name==='personal' ? '' : '_' + acc.name));
    // expand special case: work -> id_ed25519_work already correct
    sshKey = sshKey.replace('~', os.homedir());
    // but keep as ~/.ssh/... in file
    const displayKey = acc.ssh_key || ('~/.ssh/id_ed25519' + (acc.name==='personal' ? '' : '_' + acc.name));
    const sshConfigPath=path.join(os.homedir(),'.ssh/config');
    let content=fs.readFileSync(sshConfigPath,'utf8');
    // replace Host github.com block IdentityFile
    content=content.replace(/(Host github\.com\n  HostName github\.com\n  User git\n  IdentityFile ).*/,'\$1'+displayKey);
    // ensure IdentitiesOnly stays
    if(!content.includes('Host github.com\n')) {
      content += '\nHost github.com\n  HostName github.com\n  User git\n  IdentityFile '+displayKey+'\n  IdentitiesOnly yes\n';
    }
    fs.writeFileSync(sshConfigPath, content);
    console.log('Switched to '+acc.name+' ('+sc+')');
    console.log('  Git: '+acc.git_name+' <'+acc.git_email+'>');
    console.log('  SSH default -> '+displayKey);
  "
  local ret=$?
  if [[ $ret -eq 0 ]]; then
    echo ""
    current_status
  fi
  return $ret
}

add_account() {
  echo "Add new account (interactive):"
  read "acc_name?Account name (e.g., work/personal): "
  read "git_name?Git name: "
  read "git_email?Git email: "
  read "gh_user?GitHub username: "
  read "ssh_key?SSH key path [~/.ssh/id_ed25519_${acc_name}]: "
  if [[ -z "$ssh_key" ]]; then ssh_key="~/.ssh/id_ed25519_${acc_name}"; fi
  if [[ "$acc_name" == "personal" ]]; then ssh_key="~/.ssh/id_ed25519"; fi
  node -e "
    const fs=require('fs');
    const path=require('path');
    const os=require('os');
    const p=path.join(os.homedir(),'.git-accounts.json');
    const cfg=JSON.parse(fs.readFileSync(p,'utf8'));
    if(cfg.accounts.find(a=>a.name==='$acc_name')){console.error('Already exists');process.exit(1)}
    cfg.accounts.push({name:'$acc_name', git_name:'$git_name', git_email:'$git_email', gh_username:'$gh_user', ssh_key:'$ssh_key'});
    fs.writeFileSync(p, JSON.stringify(cfg,null,2));
    console.log('Added '+ '$acc_name');
  "
  # generate ssh key if not exists
  local key_path="${ssh_key/#\~/$HOME}"
  if [[ ! -f "$key_path" ]]; then
    echo "Generating SSH key: $key_path"
    ssh-keygen -t ed25519 -C "$git_email" -f "$key_path" -N ""
    echo "Public key:"
    cat "${key_path}.pub"
    echo "Add this to GitHub: https://github.com/settings/keys"
  fi
  # ensure ssh config host exists
  if ! grep -q "Host github.com-$acc_name" "$SSH_CONFIG" 2>/dev/null; then
    cat >> "$SSH_CONFIG" <<EOF

Host github.com-$acc_name
  HostName github.com
  User git
  IdentityFile $ssh_key
  IdentitiesOnly yes
EOF
    echo "Added Host github.com-$acc_name to ~/.ssh/config"
  fi
}

remove_account() {
  local name="$1"
  node -e "
    const fs=require('fs');
    const path=require('path');
    const os=require('os');
    const p=path.join(os.homedir(),'.git-accounts.json');
    let cfg=JSON.parse(fs.readFileSync(p,'utf8'));
    const before=cfg.accounts.length;
    cfg.accounts=cfg.accounts.filter(a=>a.name!=='$name');
    if(cfg.accounts.length===before){console.error('Not found: $name');process.exit(1)}
    if(cfg.last_used==='$name') cfg.last_used=cfg.accounts[0]?.name||'';
    fs.writeFileSync(p, JSON.stringify(cfg,null,2));
    console.log('Removed $name');
  "
}

case "$cmd" in
  list|ls|l) list_accounts ;;
  current|status|c|cur|me) current_status ;;
  switch|use|sw|s) switch_account "$arg" "$flag" ;;
  add|a) add_account ;;
  remove|rm|r) remove_account "$arg" ;;
  help|--help|-h) echo "gs - git + ssh switcher via ~/.git-accounts.json"; echo ""; echo "Usage: gs [1|2|name] | gs <cmd>"; echo "  gs / gs l / gs ls / gs list  # list"; echo "  gs c / gs cur / gs me        # current"; echo "  gs 1 | gs 2 | gs work        # switch --global (shorthand)"; echo "  gs s work --global/--local   # switch explicit"; echo "  gs a                         # add"; echo "  gs r <name>                  # remove"; ;;
  "" ) list_accounts ;;
  *) 
    # shorthand: gs 1 / gs 2 / gs work / gs personal -> switch --global
    # check if arg is account name or number
    if [[ "$cmd" =~ ^[0-9]+$ ]] || node -e 'const cfg=JSON.parse(require("fs").readFileSync(process.env.HOME+"/.git-accounts.json","utf8")); process.exit(cfg.accounts.find(a=>a.name===process.argv[1]) ? 0 : 1)' -- "$cmd" 2>/dev/null; then
      switch_account "$cmd" "--global"
    else
      echo "gs - git + ssh switcher via ~/.git-accounts.json"
     echo ""
     echo "Usage: gs [1|2|name] | gs <cmd>"
     echo "  gs / gs l / gs list          # list"
     echo "  gs c / gs cur                # current"
     echo "  gs 1 | gs 2 | gs work        # switch --global (shorthand)"
     echo "  gs s work --global/--local   # switch explicit"
     echo "  gs a                         # add"
     echo "  gs r <name>                  # remove"
     echo ""
     echo "Examples: gs 1, gs work, gs c"
      fi
      ;;
esac
