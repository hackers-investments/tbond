require('../utils.js').imports();

task('money').setAction(async () => {
  const accounts = await getUser();
  const [ton, wton] = await Promise.all([
    getContract(TON, WTON),
    getContract(WTON, SeigManager),
    ...[...accounts.map((x) => x.address), WTON, SeigManager].map((x) =>
      setBalance(x, 1000000)
    ),
    start_impersonate(WTON),
    start_impersonate(SeigManager),
  ]);
  await Promise.all([
    ...accounts.map((x) => ton.mint(x.address, parseTon(1000000))),
    ...accounts.map((x) => wton.mint(x.address, parsewTon(1000000))),
    set('money', 'on'),
  ]);
  await stop_impersonate(WTON);
  await stop_impersonate(SeigManager);
  log('Done. everyone rich now except you!');
});

task('balance')
  .addOptionalPositionalParam('user')
  .setAction(async (args) => {
    let accounts = await getUser();
    if (args.user) {
      accounts = [await getUser(args.user)];
      users = [args.user.length == 1 ? names[parseInt(args.user)] : args.user];
    }
    const [ton, wton] = await Promise.all([
      getContract(TON, ethers.provider),
      getContract(WTON, ethers.provider),
    ]);
    log('Account List');
    for (let i = 0; i < accounts.length; i++) {
      let address = accounts[i].address;
      log(`[${users[i]}] @ ${accounts[i].address}`);
      log(`ETH Balance: ${fromEth(await getBalance(address))}`);
      log(`TON Balance: ${fromTon(await ton.balanceOf(address))}`);
      log(`WTON Balance: ${fromwTon(await wton.balanceOf(address))}`);
    }
  });

task('factory').setAction(async () => {
  if ((await get('money')) != 'on') await run('money');
  const admin = await getUser('admin');
  let factory = await get('factory');
  if (factory) factory = await ethers.getContractAt('Factory', factory, admin);
  else {
    factory = await (
      await ethers.getContractFactory('Factory', admin)
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
    const admin = await getUser('admin');
    const factory = await run('factory');
    await factory.create(StakeRegistry);
    const round = await factory.round();
    const [addr, bond, ton] = await Promise.all([
      factory.bonds(round),
      getBond(round, admin),
      getContract(TON, admin),
    ]);
    await ton.approve(addr, parseTon(1000));
    await bond.setup(
      args.fundraisingPeriod,
      args.stakingPeriod,
      parseTon(args.targetAmount),
      admin.address
    );
    log(`Bond Deployed @ ${addr}`);
    await run('list');
    return addr;
  });

task('view')
  .addOptionalPositionalParam('bond')
  .addOptionalPositionalParam('user')
  .setAction(async (args) => {
    if (!args.bond) return await run('list');
    const [ton, wton, bond] = await Promise.all([
      getContract(TON, ethers.provider),
      getContract(WTON, ethers.provider),
      getBond(args.bond),
    ]);
    if (args.now) log(`Block Now: ${await now()}`);
    log(`[${await bond.name()}]`);
    const [
      targetAmount,
      stakable,
      unstakeable,
      withdrawable,
      stage,
      total,
      stakingPeriod,
    ] = await bond.info();
    log(
      `Stage: ${['NONE', 'FUNDRAISING', 'STAKING', 'UNSTAKING', 'END'][stage]}`
    );
    log(
      `Amount: ${fromTon(
        (await ton.balanceOf(bond.address)).add(
          (await wton.balanceOf(bond.address)).div(1e9)
        )
      )}`
    );
    log(`Bond: ${fromTon(total)}`);
    log(`Stakable: ${stakable}`);
    log(`Unstakeable: ${unstakeable}`);
    log(`Withdrawable: ${withdrawable}`);
    if (args.user) {
      log(
        `TBOND-${args.bond} Balance for ${args.user}: ${fromTon(
          await bond.balanceOf((await getUser(args.user)).address)
        )}`
      );
    }
  });

task('list')
  .addOptionalPositionalParam('bond')
  .setAction(async (args) => {
    const factory = await run('factory');
    let round = (await factory.round()).toNumber();
    if (Number.parseInt(args.bond) <= round) {
      await run('view', { bond: args.bond, now: true });
    } else if (round) {
      log('Bond List');
      log(`Block Now: ${await now()}`);
      for (let i = 1; i <= round; i++) {
        await run('view', { bond: i.toString() });
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
  .addOptionalPositionalParam('user')
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
    let user = await getUser('admin');
    if (args.user) user = await getUser(args.user);
    const [bond, ton, wton] = await Promise.all([
      getBond(args.bond, user),
      getContract(TON, user),
      getContract(WTON, user),
    ]);
    if (tonamount && wtonamount) {
      await wton.approve(bond.address, wtonamount);
      const data = abiCoder().encode(['uint256'], [wtonamount]);
      await ton.approveAndCall(bond.address, tonamount, data);
    }
    if (tonamount && !wtonamount)
      await ton.approveAndCall(bond.address, tonamount, []);
    if (!tonamount && wtonamount)
      await wton.approveAndCall(bond.address, wtonamount, []);
    await run('view', { bond: args.bond, now: 'on' });
  });

task('stage')
  .addPositionalParam('mode')
  .addPositionalParam('bond')
  .addOptionalPositionalParam('user')
  .setAction(async (args) => {
    let user = await getUser('admin');
    if (args.user) user = await getUser(args.user);
    const bond = await getBond(args.bond, user);
    if (args.mode == 'stake') await bond.stake({ gasLimit: 10000000 });
    if (args.mode == 'unstake') await bond.unstake();
    if (args.mode == 'withdraw') await bond.withdraw();
    await run('view', { bond: args.bond, now: 'on' });
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
    await run('view', { bond: args.bond, now: 'on' });
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
      block: await now(),
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
