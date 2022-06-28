require('../utils.js').imports();

extendEnvironment((hre) => {
  hre.users = ['admin', 'user1', 'user2', 'user3', 'user4'];
  hre.snapshotlist = (snapshotData) => {
    if (Object.keys(snapshotData).length) {
      log('Snapshot List');
      for (let name of Object.keys(snapshotData)) {
        log(`Name: ${name}`);
        log(`BlockNumber: ${snapshotData[name].block}`);
      }
    }
  };
  hre.getContract = async (addr, signer) => {
    if (typeof signer == 'string') signer = await ethers.getSigner(signer);
    return await new ethers.Contract(addr, ABI, signer);
  };
  hre.getBond = async (number, signer) => {
    const factory = await run('deploy');
    const addr = await factory.bonds(number);
    return await ethers.getContractAt('Bond', addr, signer);
  };
  hre.getUser = async (user) => {
    const accounts = await ethers.getSigners();
    const index = hre.users.indexOf(user);
    if (index == -1) return accounts[parseInt(user)];
    else return accounts[index];
  };
});

task('money').setAction(async () => {
  const accounts = await ethers.getSigners();
  await start_impersonate(WTON);
  await start_impersonate(SeigManager);
  for (const addr of accounts.map((x) => x.address).concat([WTON, SeigManager]))
    await setBalance(addr, 1000000);
  const ton = await hre.getContract(TON, WTON);
  const wton = await hre.getContract(WTON, SeigManager);
  for (const addr of accounts.map((x) => x.address)) {
    await ton.mint(addr, parseTon(1000000));
    await wton.mint(addr, parsewTon(1000000));
  }
  await stop_impersonate(WTON);
  await stop_impersonate(SeigManager);
  await set('money', 'on');
  log('Done. everyone rich now except you!');
});

task('balance')
  .addOptionalPositionalParam('user')
  .setAction(async (args) => {
    var users = [args.user];
    var accounts = await ethers.getSigners();
    const index = hre.users.indexOf(args.user);
    if (index == -1) users = hre.users;
    else accounts = [accounts[index]];
    const ton = await hre.getContract(TON, ethers.provider);
    const wton = await hre.getContract(WTON, ethers.provider);
    log('Account List');
    for (let i = 0; i < users.length; i++) {
      let address = accounts[i].address;
      log(`[${users[i]}]`);
      log(`ETH Balance: ${fromEth(await getBalance(address))}`);
      log(`TON Balance: ${fromTon(await ton.balanceOf(address))}`);
      log(`WTON Balance: ${fromwTon(await wton.balanceOf(address))}`);
    }
  });

task('deploy').setAction(async () => {
  if ((await get('money')) != 'on') await run('money');
  const accounts = await ethers.getSigners();
  let factory = await get('factory');
  if (factory)
    factory = await ethers.getContractAt('Factory', factory, accounts[0]);
  else {
    factory = await (
      await ethers.getContractFactory('Factory', accounts[0])
    ).deploy();
    await factory.deployed();
    await set('factory', factory.address);
    log(`Factory Deployed @ ${factory.address}`);
  }
  return factory;
});

task('make')
  .addPositionalParam('fundraisingPeriod')
  .addPositionalParam('stakingPeriod')
  .addPositionalParam('targetAmount')
  .setAction(async (args) => {
    const accounts = await ethers.getSigners();
    const factory = await run('deploy');
    await factory.create(StakeRegistry);
    const round = await factory.round();
    const addr = await factory.bonds(round);
    const bond = await hre.getBond(round, accounts[0]);
    const ton = await hre.getContract(TON, accounts[0]);
    await ton.approve(addr, parseTon(1000));
    await bond.setup(
      args.fundraisingPeriod,
      args.stakingPeriod,
      parseTon(args.targetAmount),
      accounts[0].address
    );
    log(`Bond Deployed @ ${addr}`);
    await run('list');
    return addr;
  });

task('view')
  .addPositionalParam('number')
  .addOptionalPositionalParam('user')
  .setAction(async (args) => {
    const ton = await hre.getContract(TON, ethers.provider);
    const bond = await hre.getBond(args.number);
    const stage = Number.parseInt(await bond.stage());
    if (args.now) log(`Block Now: ${await now()}`);
    log(`[${await bond.name()}]`);
    const [targetAmount, stakable, unstakeable, withdrawable] =
      await bond.info();
    log(
      `Stage: ${['NONE', 'FUNDRAISING', 'STAKING', 'UNSTAKING', 'END'][stage]}`
    );
    log(
      `Amount: ${fromTon(await ton.balanceOf(bond.address))} / ${fromTon(
        targetAmount
      )}`
    );
    log(`Stakable: ${stakable}`);
    log(`Unstakeable: ${unstakeable}`);
    log(`Withdrawable: ${withdrawable}`);
    if (args.user) {
      const user = await hre.getUser(args.user);
      log(
        `TBOND-${args.number} Balance: ${await bond.balanceOf(user.address)}`
      );
    }
  });

task('list').setAction(async () => {
  const factory = await run('deploy');
  const round = (await factory.round()).toNumber();
  if (round) {
    log('Bond List');
    log(`Block Now: ${await now()}`);
    for (let i = 1; i <= round; i++) {
      await run('view', { number: i.toString() });
      if (i != round) log('='.repeat(51));
    }
  } else {
    await run('make', {
      fundraisingPeriod: '10000',
      stakingPeriod: '10000',
      targetAmount: '1000',
    });
  }
});

task('invest')
  .addPositionalParam('bond')
  .addPositionalParam('amount')
  .addPositionalParam('user')
  .setAction(async (args) => {
    let tonamount, wtonamount;
    if (args.amount.includes('/')) {
      [tonamount, wtonamount] = args.amount.split('/');
      tonamount = parseTon(tonamount);
      wtonamount = parsewTon(wtonamount);
    } else if (args.amount.endsWith('wton'))
      wtonamount = parsewTon(args.amount.slice(0, -4));
    else if (args.amount.endsWith('ton'))
      tonamount = parseTon(args.amount.slice(0, -3));
    else tonamount = parseTon(args.amount);
    const user = await hre.getUser(args.user);
    const bond = await hre.getBond(args.bond, user);
    const ton = await hre.getContract(TON, user);
    const wton = await hre.getContract(WTON, user);
    if (tonamount && wtonamount) {
      await ton.approve(bond.address, tonamount);
      await wton.approve(bond.address, wtonamount);
      await bond.depositBoth(tonamount, wtonamount);
    }
    if (tonamount && !wtonamount) {
      await ton.approve(bond.address, tonamount);
      await bond.depositTON(tonamount);
    }
    if (!tonamount && wtonamount) {
      await wton.approve(bond.address, wtonamount);
      await bond.depositWTON(wtonamount);
    }
    await run('view', { number: args.bond, now: 'on' });
  });

task('stage')
  .addPositionalParam('mode')
  .addPositionalParam('bond')
  .addOptionalPositionalParam('user')
  .setAction(async (args) => {
    let user = await hre.getUser('admin');
    if (args.user) user = await hre.getUser(args.user);
    const bond = await hre.getBond(args.bond, user);
    if (args.mode == 'stake')
      await bond.stake((overrides = { gasLimit: 10000000 }));
    if (args.mode == 'unstake') await bond.unstake();
    if (args.mode == 'withdraw') await bond.withdraw();
    await run('view', { number: args.bond, now: 'on' });
  });

task('claim')
  .addPositionalParam('mode')
  .addPositionalParam('bond')
  .addPositionalParam('amount')
  .addPositionalParam('user')
  .setAction(async (args) => {
    const user = await hre.getUser(args.user);
    const bond = await hre.getBond(args.bond, user);
    if (args.mode == 'claim') await bond.claim(parseTon(args.amount));
    if (args.mode == 'refund') await bond.refund(parseTon(args.amount));
    await run('view', { number: args.bond, now: 'on' });
  });

task('save')
  .addPositionalParam('name')
  .setAction(async (args) => {
    let snapshotData = await get('snapshot');
    if (snapshotData) snapshotData = JSON.parse(snapshotData);
    else snapshotData = {};
    if (Object.keys(snapshotData).includes(args.name)) {
      log('Wake! - Name conflicts');
      return;
    }
    snapshotData[args.name] = {
      block: await ethers.provider.getBlockNumber(),
      number: await snapshot(),
    };
    await set('snapshot', JSON.stringify(snapshotData));
    hre.snapshotlist(snapshotData);
  });

task('load')
  .addPositionalParam('name')
  .setAction(async (args) => {
    let snapshotData = await get('snapshot');
    if (Object.keys(snapshotData).includes(args.name)) {
      const result = await revert(snapshotData[args.name].number);
      if (result) {
        log('Snapshot revert success');
        delete snapshotData[args.name];
        await set('snapshot', JSON.stringify(snapshotData));
      } else log('Snapshot revert fail');
    } else log('Snapshot not found');
    hre.snapshotlist(snapshotData);
  });

task('mine')
  .addOptionalPositionalParam('exp')
  .setAction(async (args) => {
    var number = 10000;
    if (args.exp) number = eval(args.exp);
    await mining(eval(number));
    log(`Mining ${number} Blocks`);
    await run('list');
  });

task('now').setAction(async () => {
  log(`Block Now: ${await now()}`);
});
