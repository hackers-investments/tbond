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
alias task='check && npx hardhat $1 --network localhost'
alias test='npx hardhat test $1'
alias money='task money'
alias balance='task balance'
alias deploy='task deploy'
alias make='task make $1 $2 $3'
alias list='task list'
alias invest='task invest $1 $2 $3'
alias stake='task stake $1 $2'
alias unstake='task unstake $1 $2'
alias withraw='task withraw $1 $2'
alias claim='task claim $1 $2 $3'
alias save='task save'
alias load='task load $1'