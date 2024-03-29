alias start='npx hardhat node --hostname 0.0.0.0'
alias stop='pkill -KILL -f "hardhat"'
check () {
  if [[ ! `pgrep 'npm exec'` ]]
  then
  echo 'running hardhat node'
  start &>/dev/null&
  sleep 6
  echo 'done'
  fi
}
alias console='npx hardhat console'
alias compile='npx hardhat compile'
alias task='check && npx hardhat --network localhost'
alias test='npx hardhat test'
alias accounts=''
alias money='task money'
alias balance='task balance'
alias make='task make'
alias list='task list'
alias view='task view'
alias invest='task invest'
alias stake='task stage stake'
alias unstake='task stage unstake'
alias withdraw='task stage withdraw'
alias claim='task claim claim'
alias refund='task claim refund'
alias save='task save'
alias load='task load'
alias snapshot='task snapshotlist'
alias mine='task mine'
alias now='task now'
alias buy='task buy'
alias sell='task sell'
alias cancel='task cancel'
alias factory='task factory'
alias exchange='task exchange'
alias auction='task auction'
trade() {
  stop
  make 10 10 1000
  invest 1 20 user1
  sell 1 20 40 1 user1
  auction
  echo buy 0 user2
}
bond() {
  stop
  list
  mine
  stake 1
  mine
  unstake 1
  mine 100000
  withdraw 1
  view 1 admin
  claim 1 1000 admin
  balance admin
}
reset() { # temp command set for front dev
  stop
  factory
  exchange
  money 0x92Fb30eA18557A93cDB3a0f77796223e36FcEdDB
  make 100 100 100000
}