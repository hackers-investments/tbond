const utils = {
  ABI: [
    'function transfer(address, uint) returns (bool)',
    'function balanceOf(address) view returns (uint)',
    'function approve(address, uint) returns (bool)',
    'function owner() view returns (address)',
    'function transferOwnership(address)',
    'function isMinter(address) view returns (bool)',
    'function mint(address, uint) returns (bool)',
    'function swapFromTON(uint tonAmount) public returns (bool)',
    'function swapFromTONAndTransfer(address, uint) returns (bool)',
    'function depositBoth(uint, uint)',
    'function depositWTON(uint)',
    'function depositTON(uint)',
    'function info() view returns (uint, uint , uint , uint)',
    'function approveAndCall(address,uint,bytes)',
  ],
  TON: '0x2be5e8c109e2197D077D13A82dAead6a9b3433C5',
  WTON: '0xc4A11aaf6ea915Ed7Ac194161d2fC9384F15bff2',
  SeigManager: '0x710936500ac59e8551331871cbad3d33d5e0d909',
  StakeRegistry: '0x4Fa71D6964a97c043CA3103407e1B3CD6b5Ab367',
  key: (n) => ethers.utils.id(`TBOND-${n}`),
  log: (msg) => console.log(msg ? msg : ''),
  hex: (v) => `0x${v.toHexString().match(/(0x[0]*)([a-fA-F0-9]*)/)[2]}`,
  sum: (...args) => eval(args.map(Number.parseFloat).join('+')),
  parseEth: (v) => ethers.utils.parseUnits(Number.parseInt(v).toString(), 18),
  parseTon: (v) => ethers.utils.parseUnits(Number.parseInt(v).toString(), 18),
  parsewTon: (v) => ethers.utils.parseUnits(Number.parseInt(v).toString(), 27),
  fromEth: function (v) {
    return this.fromTon(v);
  },
  fromTon: (v) => ethers.utils.formatUnits(ethers.BigNumber.from(v), 18),
  fromwTon: (v) => ethers.utils.formatUnits(ethers.BigNumber.from(v), 27),
  mining: (n) => network.provider.send('hardhat_mine', [`0x${n.toString(16)}`]),
  setBalance: function (a, v) {
    return network.provider.send('hardhat_setBalance', [
      a,
      this.hex(this.parseEth(v)),
    ]);
  },
  getBalance: (a) => ethers.provider.getBalance(a),
  start_impersonate: (addr) =>
    network.provider.send('hardhat_impersonateAccount', [addr]),
  stop_impersonate: (addr) =>
    network.provider.send('hardhat_stopImpersonatingAccount', [addr]),
  set: (k, v) =>
    network.provider.send('hardhat_setCode', [
      ethers.utils.id(k).slice(0, 42),
      `0x${Buffer.from(v).toString('hex')}`,
    ]),
  get: async (k) =>
    Buffer.from(
      (
        await network.provider.send('eth_getCode', [
          ethers.utils.id(k).slice(0, 42),
        ])
      ).slice(2),
      'hex'
    ).toString(),
  snapshot: () => network.provider.send('evm_snapshot', []),
  revert: (n) => network.provider.send('evm_revert', [n]),
  reset: () => network.provider.send('hardhat_reset', []),
  now: () => ethers.provider.getBlockNumber(),
};

module.exports = {
  imports: () => Object.keys(utils).forEach((id) => (global[id] = utils[id])),
};
