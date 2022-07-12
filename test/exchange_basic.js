const { expect } = require('chai');

require('../utils.js').imports();

describe('Test for TBOND Exchange(basic)', () => {
  let bond;
  let wton;
  let factory;
  let user1Signer;
  let user1Address;
  let user2Signer;
  let user2Address;
  let exchange;

  const domain = (exchange) => ({
    name: 'TBond Exchange',
    version: '1.0',
    chainId: ethers.provider._network.chainId,
    verifyingContract: exchange.address,
  });

  const type = {
    Order: [
      { name: 'owner', type: 'address' },
      { name: 'bond', type: 'uint256' },
      { name: 'bondAmount', type: 'uint256' },
      { name: 'wtonAmount', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };
  it('0. clean & initialize', async () => {
    // addr 주소에 TON 토큰 민팅
    await setBalance(WTON, parseEth(5));
    await setBalance(SeigManager, parseEth(5));
    await start_impersonate(WTON);
    await start_impersonate(SeigManager);
    ton = await getContract(TON, WTON);
    wton = await getContract(WTON, SeigManager);

    const signers = await getUser();
    for (let idx = 0; idx < signers.length; idx++) {
      const signer = signers[idx];
      const address = signer.address;

      const wtonBalance = await wton.balanceOf(address);
      await wton.connect(signer).swapToTON(wtonBalance);

      const tonBalance = await ton.balanceOf(address);
      ton.connect(signer).transfer(ZeroAddress, tonBalance);
    }
  });
  it('1. deploy & setup TBOND contract', async () => {
    user1Signer = await getUser(0);
    user1Address = user1Signer.address;
    user2Signer = await getUser(1);
    user2Address = user2Signer.address;

    const Factory = await ethers.getContractFactory('Factory');
    factory = await Factory.deploy();
    await factory.deployed();

    await factory.create(StakeRegistry);
    bond = await ethers.getContractAt('Bond', await factory.bonds(1));

    // TBOND 토큰을 민팅하고, 거래에 사용하기 위한 TON/WTON 토큰 생성
    await setBalance(WTON, parseEth(5));
    await setBalance(SeigManager, parseEth(5));
    await start_impersonate(WTON);
    await start_impersonate(SeigManager);
    const ton = await getContract(TON, WTON);
    wton = await getContract(WTON, SeigManager);

    await ton.mint(user1Address, parseTon(1000));
    await wton.mint(user2Address, parsewTon(1000));

    // TON 컨트랙트가 WTON signer로 생성되었기 때문에 connect 해줘야함
    await ton.connect(user1Signer).approve(bond.address, parseTon(1000));
    await bond.setup(
      100, // _fundraisingPeriod
      100, // _stakingPeriod
      parseTon(10000), // _targetAmount
      user1Address // _incentiveTo
    );
  });
  it('2. deploy Exchange contract', async () => {
    const Exchange = await ethers.getContractFactory('Exchange');
    exchange = await Exchange.deploy(factory.address, WTON);
    await exchange.deployed();
  });
  it('3. Exchange 1000 TBOND & 1000 WTON', async () => {
    const order = {
      owner: user1Address,
      bond: 1,
      bondAmount: parseTon(1000).toString(),
      wtonAmount: parsewTon(1000).toString(),
      nonce: await nonce(user1Address),
      deadline: new Date().getTime() + 1000,
    };

    // TBOND를 판매하기 위한 order 데이터와 sign 생성
    const sign = getSign(
      await user1Signer._signTypedData(domain(exchange), type, order)
    );
    // TBOND를 판매하기 위해 거래소에 approve
    await bond.increaseAllowance(exchange.address, order.bondAmount);

    // storage를 절약하기 위해 매수자의 경우 order의 해시값만 전달하고,
    // 컨트랙트에서 order를 해시한 값과 매수자가 전달한 해시값이 일치하는지 확인
    const proof = keccak256()(
      abiCoder().encode(
        ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
        [
          user2Address,
          order.bond,
          order.bondAmount,
          order.wtonAmount,
          order.deadline,
          order.nonce,
        ]
      )
    );

    // WTON으로 TBOND를 매수하기 위해 거래소에 approve(approveAndCall로 대체할 예정)
    await wton.connect(user2Signer).increaseAllowance(exchange.address, order.wtonAmount);
    await exchange.connect(user2Signer).executeOrder(order, sign, proof);

    const user2TbondBalance = parseInt(fromTon(await bond.balanceOf(user2Address)));
    const user1WtonBalance = parseInt(fromwTon(await wton.balanceOf(user1Address)));
    expect(user2TbondBalance).to.be.equal(1000);
    expect(user1WtonBalance).to.be.equal(1000);
  });
});
