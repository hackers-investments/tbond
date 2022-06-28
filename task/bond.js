require('../utils.js').imports();

task('money').setAction(async () => {
  const accounts = await ethers.getSigners();
  await start_impersonate(WTON);
  await start_impersonate(SeigManager);
  for (const addr of accounts.map((x) => x.address).concat([WTON, SeigManager]))
    await setBalance(addr, 1000000);
  const ton = await getContract(TON, WTON);
  const wton = await getContract(WTON, SeigManager);
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
    let accounts = await ethers.getSigners();
    if (args.user) {
      accounts = [await getUser(args.user, accounts)];
      users = [args.user];
    }
    const ton = await getContract(TON, ethers.provider);
    const wton = await getContract(WTON, ethers.provider);
    log('Account List');
    for (let i = 0; i < accounts.length; i++) {
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
    const bond = await getBond(round, accounts[0]);
    const ton = await getContract(TON, accounts[0]);
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
    const ton = await getContract(TON, ethers.provider);
    const bond = await getBond(args.number);
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
    log(
      `Bond: ${fromTon(await bond.totalSupply())}`
    );
    log(`Stakable: ${stakable}`);
    log(`Unstakeable: ${unstakeable}`);
    log(`Withdrawable: ${withdrawable}`);
    if (args.user) {
      const user = await getUser(args.user);
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
    const user = await getUser(args.user);
    const bond = await getBond(args.bond, user);
    const ton = await getContract(TON, user);
    const wton = await getContract(WTON, user);
    if (tonamount && wtonamount) {
      await wton.approve(bond.address, wtonamount);
      const abicoder = ethers.utils.defaultAbiCoder;
      const data = abicoder.encode(
        ['uint256'],
        [wtonamount]
      );
      await ton.approveAndCall(bond.address, tonamount, data);
    }
    if (tonamount && !wtonamount) {
      await ton.approveAndCall(bond.address, tonamount, []);
    }
    if (!tonamount && wtonamount) {
      await wton.approveAndCall(bond.address, wtonamount, []);
    }

    await run('view', { number: args.bond, now: 'on' });
  });

task('stage')
  .addPositionalParam('mode')
  .addPositionalParam('bond')
  .addOptionalPositionalParam('user')
  .setAction(async (args) => {
    let user = await getUser('admin');
    if (args.user) user = await getUser(args.user);
    const bond = await getBond(args.bond, user);
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
    const user = await getUser(args.user);
    const bond = await getBond(args.bond, user);
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
    snapshotlist(snapshotData);
  });

task('load')
  .addPositionalParam('name')
  .setAction(async (args) => {
    let snapshotData = await get('snapshot');
    if (snapshotData) snapshotData = JSON.parse(snapshotData);
    if (Object.keys(snapshotData).includes(args.name)) {
      const result = await revert(snapshotData[args.name].number);
      if (result) {
        log('Snapshot revert success');
        delete snapshotData[args.name];
        await set('snapshot', JSON.stringify(snapshotData));
      } else log('Snapshot revert fail');
    } else log('Snapshot not found');
    snapshotlist(snapshotData);
  });

task('snapshotlist').setAction(async () => {
  let snapshotData = await get('snapshot');
  if (snapshotData) snapshotData = JSON.parse(snapshotData);
  snapshotlist(snapshotData);
});

task('mine')
  .addOptionalPositionalParam('exp')
  .setAction(async (args) => {
    let number = 10000;
    if (args.exp) number = eval(args.exp);
    await mining(eval(number));
    log(`Mining ${number} Blocks`);
    await run('list');
  });

task('now').setAction(async () => {
  log(`Block Now: ${await now()}`);
});
