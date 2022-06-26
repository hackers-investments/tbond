alias start='npx hardhat node'
alias stop='pkill -KILL -f "hardhat"'
check () {
  if [[ ! `pgrep 'npm exec hardhat node'` ]]
  then
  echo 'running hardhat node'
  start &>/dev/null&
  sleep 3
  echo 'done'
  fi
}
alias console='npx hardhat console'
alias compile='npx hardhat compile'
alias task='check && npx hardhat --network localhost'
alias test='npx hardhat test'
alias money='task money'
alias balance='task balance'
alias deploy='task deploy'
alias make='task make'
alias list='task list'
alias view='task view'
alias invest='task invest'
alias stake='task stage stake'
alias unstake='task stage unstake'
alias withraw='task stage withraw'
alias claim='task claim claim'
alias refund='task claim refund'
alias save='task save'
alias load='task load'
alias mine='task mine'
alias now='task now'