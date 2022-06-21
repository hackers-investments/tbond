const utils = {
  ABI:[
    'function transfer(address, uint) returns (bool)',
    'function balanceOf(address) view returns (uint)',
    'function approve(address, uint256) returns (bool)',
    'function owner() view returns (address)',
    'function transferOwnership(address)',
    'function isMinter(address) view returns (bool)',
    'function mint(address, uint256) returns (bool)',
    'function swapFromTON(uint256 tonAmount) public returns (bool)',
    'function swapFromTONAndTransfer(address, uint256) returns (bool)',
    'function depositBoth(uint256, uint256)',
    'function depositWTON(uint256)',
    'function depositTON(uint256)'
  ],
  TON:'0x2be5e8c109e2197D077D13A82dAead6a9b3433C5',
  WTON:'0xc4A11aaf6ea915Ed7Ac194161d2fC9384F15bff2',
  LAYER2:'0x42ccf0769e87cb2952634f607df1c7d62e0bbc52',
  SeigManager:'0x710936500ac59e8551331871cbad3d33d5e0d909',
  StakeRegistry:'0x4Fa71D6964a97c043CA3103407e1B3CD6b5Ab367',
  set:(k, v) => {
    if (hre.config.tbond == undefined) hre.config.tbond = {}
    hre.config.tbond[k] = v
  },
  get:k => hre.config.tbond[k],
  key:n => ethers.utils.id(`TBOND-${n}`),
  log:msg => console.log(msg ? msg : ''),
  hex:v => `0x${v.toHexString().match(/(0x[0]+)([a-fA-F0-9]*)/)[2]}`,
  sum:(...args) => eval(args.map(Number.parseFloat).join('+')),
  parseEth:v => ethers.utils.parseUnits(Number.parseInt(v).toString(), 18),
  parseTon:v => ethers.utils.parseUnits(Number.parseInt(v).toString(), 18),
  parsewTon:v => ethers.utils.parseUnits(Number.parseInt(v).toString(), 27),
  fromTon:v => ethers.utils.formatUnits(ethers.BigNumber.from(v), 18),
  fromwTon:v => ethers.utils.formatUnits(ethers.BigNumber.from(v), 27),
  mining:async n => await hre.network.provider.send('hardhat_mine', [`0x${n.toString(16)}`]),
  start_impersonate:async addr => await hre.network.provider.send('hardhat_impersonateAccount',[addr]),
  stop_impersonate:async addr => await hre.network.provider.send('hardhat_stopImpersonatingAccount', [addr]),
}

module.exports = { imports:() => Object.keys(utils).forEach(id => global[id] = utils[id]) }