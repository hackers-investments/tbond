const { ethers } = require('hardhat');
const chai = require("chai");
const { expect } = chai;

require('../utils.js').imports();

describe('Test for BOND contract', () => {

  let ton;
  let wton;
  let bond;

  it('1. deploy TBOND', async () => {
    // addr 주소에 TON 토큰 민팅
    await setBalance(WTON, parseEth(5));
    await setBalance(SeigManager, parseEth(5));

    await start_impersonate(WTON);
    await start_impersonate(SeigManager);

    ton = await getContract(TON, WTON);
    wton = await getContract(WTON, SeigManager);

    // Bond 컨트랙트 생성
    const Factory = await ethers.getContractFactory('Factory');
    const factory = await Factory.deploy();
    await factory.create(StakeRegistry);

    // Factory 컨트랙트의 bonds 배열에는 생성된 bond 컨트랙트의 주소가 저장되어 있음
    // bonds 배열읜 index는 1부터 시작
    bond = await ethers.getContractAt('Bond', await factory.bonds(1));
  });

  it('2. setup TBOND', async () => {
    const adminSigner = getUser(0);
    const adminAddress = adminSigner.address;

    // TBOND 컨트랙트의 INITIAL_DEPOSIT_TON이 변경될 경우 바꿔야함
    await ton.mint(adminAddress, parseTon(1000));
    await ton.connect(adminSigner).approve(bond.address, parseTon(1000));

    await bond.setup(
      100, // _fundraisingPeriod
      100, // _stakingPeriod
      parseTon(10000), // _targetAmount
      adminAddress // _incentiveTo
    );

    const tonBalance = await ton.balanceOf(adminAddress);
    expect(parseInt(fromEth(tonBalance))).to.be.equal(0);
  });

  it('3. deposit 5000 TON', async () => {
    const userSigner = getUser(1);
    const userAddress = userSigner.address;

    const tonAmount = parseTon(5000);
    await ton.mint(userAddress, tonAmount);
    await ton.connect(userSigner).approveAndCall(bond.address, tonAmount, []);

    const tonBalance = await ton.balanceOf(userAddress);
    expect(parseInt(fromEth(tonBalance))).to.be.equal(0);
  });

  it('4. deposit 5000 WTON', async () => {
    const userSigner = getUser(2);
    const userAddress = userSigner.address;

    const wtonAmount = parsewTon(5000);
    await wton.mint(userAddress, wtonAmount);
    await wton.connect(userSigner).approveAndCall(bond.address, wtonAmount, []);

    const tonBalance = await ton.balanceOf(userAddress);
    expect(parseInt(fromEth(tonBalance))).to.be.equal(0);
  });

  it('5. stake()', async () => {
    // mint TON (+1 block)
    // approveAndCall TON (+1 block)
    // mint WTON (+1 block)
    // approveAndCall WTON (+1 block)
    // stake (+1 block)
    mining(95);

    await bond.stake();
  });

  it('6. unstake()', async () => {
    // unstake (+1 block)
    mining(99);

    await bond.unstake();
  });

  it('7. withdraw()', async () => {
    // withdraw delay == 93046
    // unstake (+1 block)
    mining(93046);

    await bond.withdraw();
  });

  it('8. User1 claim()', async () => {
    const userSigner = getUser(1);
    const userAddress = userSigner.address;

    tbondBalance = await bond.balanceOf(userAddress);
    await bond.connect(userSigner).claim(tbondBalance);

    tonBalance = await ton.balanceOf(userAddress);

    expect(parseInt(fromEth(tonBalance))).to.be.above(parseInt(fromEth(tbondBalance)));
  });

  it('9. User2 claim()', async () => {
    const userSigner = getUser(2);
    const userAddress = userSigner.address;

    tbondBalance = await bond.balanceOf(userAddress);
    await bond.connect(userSigner).claim(tbondBalance);

    tonBalance = await ton.balanceOf(userAddress);

    expect(parseInt(fromEth(tonBalance))).to.be.above(parseInt(fromEth(tbondBalance)));
  });

  it('10. Admin claim()', async () => {
    const adminSigner = getUser(0);
    const adminAddress = adminSigner.address;

    tbondBalance = await bond.balanceOf(adminAddress);
    await bond.connect(adminSigner).claim(tbondBalance);

    tonBalance = await ton.balanceOf(adminAddress);

    expect(parseInt(fromEth(tonBalance))).to.be.above(parseInt(fromEth(tbondBalance)));
  });

  it('11. check TON balance of TBOND contract', async () => {
    const tonBalnace = await ton.balanceOf(bond.address);
    expect(parseInt(fromEth(tonBalnace))).to.be.equal(0);
  });
});