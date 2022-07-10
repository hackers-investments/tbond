const utils = {
  ABI: [
    'function transfer(address, uint) returns (bool)',
    'function balanceOf(address) view returns (uint)',
    'function approve(address, uint) returns (bool)',
    'function owner() view returns (address)',
    'function mint(address, uint) returns (bool)',
    'function swapFromTON(uint tonAmount) public returns (bool)',
    'function swapFromTONAndTransfer(address, uint) returns (bool)',
    'function bondInfo() view returns (uint, uint , uint , uint)',
    'function approveAndCall(address,uint,bytes)',
  ],
  TON: '0x2be5e8c109e2197D077D13A82dAead6a9b3433C5',
  WTON: '0xc4A11aaf6ea915Ed7Ac194161d2fC9384F15bff2',
  SeigManager: '0x710936500ac59e8551331871cbad3d33d5e0d909',
  StakeRegistry: '0x4Fa71D6964a97c043CA3103407e1B3CD6b5Ab367',
  users: ['admin', 'user1', 'user2', 'user3', 'user4'],
  abicoder: () => ethers.utils.defaultAbiCoder,
  key: (n) => ethers.utils.id(`TBOND-${n}`),
  log: (msg) => console.log(msg ? msg : ''),
  hex: (v) => `0x${v.toHexString().match(/(0x[0]*)([a-fA-F0-9]*)/)[2]}`,
  sum: (...args) => eval(args.map(Number.parseFloat).join('+')),
  parseEth: (v) => ethers.utils.parseUnits(Number.parseInt(v).toString(), 18),
  parseTon: (v) => ethers.utils.parseUnits(Number.parseInt(v).toString(), 18),
  parsewTon: (v) => ethers.utils.parseUnits(Number.parseInt(v).toString(), 27),
  fromTon: (v) => ethers.utils.formatUnits(ethers.BigNumber.from(v), 18),
  fromEth: (v) => fromTon(v),
  fromwTon: (v) => ethers.utils.formatUnits(ethers.BigNumber.from(v), 27),
  mining: (n) => ethers.provider.send('hardhat_mine', [`0x${n.toString(16)}`]),
  setBalance: (a, v) =>
    ethers.provider.send('hardhat_setBalance', [a, hex(parseEth(v))]),
  getBalance: (a) => ethers.provider.getBalance(a),
  start_impersonate: (addr) =>
    ethers.provider.send('hardhat_impersonateAccount', [addr]),
  stop_impersonate: (addr) =>
    ethers.provider.send('hardhat_stopImpersonatingAccount', [addr]),
  set: (k, v) =>
    ethers.provider.send('hardhat_setCode', [
      ethers.utils.id(k).slice(0, 42),
      `0x${Buffer.from(v).toString('hex')}`,
    ]),
  get: async (k) =>
    Buffer.from(
      (
        await ethers.provider.send('eth_getCode', [
          ethers.utils.id(k).slice(0, 42),
        ])
      ).slice(2),
      'hex'
    ).toString(),
  snapshot: () => ethers.provider.send('evm_snapshot', []),
  revert: (n) => ethers.provider.send('evm_revert', [n]),
  reset: () => ethers.provider.send('hardhat_reset', []),
  now: () => ethers.provider.getBlockNumber(),
  snapshotlist: (data) => {
    if (Object.keys(data).length) {
      log('Snapshot List');
      for (let name of Object.keys(data)) {
        log(`Name: ${name}`);
        log(`BlockNumber: ${data[name].block}`);
      }
    }
  },
  getContract: async (addr, signer) => {
    if (typeof signer == 'string') signer = await ethers.getSigner(signer);
    return await new ethers.Contract(addr, ABI, signer);
  },
  getBond: async (number, signer) => {
    const factory = await run('factory');
    const addr = await factory.bonds(number);
    return await ethers.getContractAt('Bond', addr, signer);
  },
  names: ['admin', 'user1', 'user2', 'user3', 'user4'],
  getUser: async (user) => {
    const accounts = await Promise.all(
      [
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
        '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
        '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
        '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
      ].map((x) => new ethers.Wallet(x, ethers.provider))
    );
    if (user == undefined) return accounts;
    const index = names.indexOf(user);
    if (index == -1) return accounts[parseInt(user)];
    else return accounts[index];
  },
  getSign: (sig) => {
    sig = sig.substr(2);
    const r = '0x' + sig.slice(0, 64);
    const s = '0x' + sig.slice(64, 128);
    const v = parseInt('0x' + sig.slice(128, 130), 16);
    return abicoder().encode(['uint8', 'bytes32', 'bytes32'], [v, r, s]);
  },
};

module.exports = {
  imports: () => Object.keys(utils).forEach((id) => (global[id] = utils[id])),
};
