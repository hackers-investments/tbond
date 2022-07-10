const { ethers } = require('hardhat');
const chai = require("chai");
const { expect } = chai;

require('../utils.js').imports();

describe('Test for BOND contract(with small deposit)', () => {
  let ton;
  let wton;
  let bond;
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

      const tonBalance = await ton.balanceOf(address);
      ton.connect(signer).transfer(ZeroAddress, tonBalance);

      const wtonBalance = await wton.balanceOf(address);
      wton.connect(signer).transfer(ZeroAddress, wtonBalance);
    }
  });
  it('1. deploy TBOND', async () => {
    // Bond 컨트랙트 생성
    const Factory = await ethers.getContractFactory('Factory');
    const factory = await Factory.deploy();
    await factory.create(StakeRegistry);

    // Factory 컨트랙트의 bonds 배열에는 생성된 bond 컨트랙트의 주소가 저장되어 있음
    // bonds 배열읜 index는 1부터 시작
    bond = await ethers.getContractAt('Bond', await factory.bonds(1));
  });
  it('2. setup TBOND with 100 TON(abnormal)', async () => {
    const adminSigner = await getUser(0);
    const adminAddress = adminSigner.address;

    // TBOND 컨트랙트의 INITIAL_DEPOSIT_TON이 변경될 경우 바꿔야함
    await ton.mint(adminAddress, parseTon(100));
    await ton.connect(adminSigner).approve(bond.address, parseTon(100));

    await expect(bond.setup(
      100, // _fundraisingPeriod
      100, // _stakingPeriod
      parseTon(10000), // _targetAmount
      adminAddress // _incentiveTo
    )).to.be.reverted;

    const tonBalance = await ton.balanceOf(adminAddress);
    expect(parseInt(fromEth(tonBalance))).to.be.equal(100);
  });
  it('3. setup TBOND with 1000 TON(normal)', async () => {
    const adminSigner = await getUser(0);
    const adminAddress = adminSigner.address;

    // TBOND 컨트랙트의 INITIAL_DEPOSIT_TON이 변경될 경우 바꿔야함
    await ton.mint(adminAddress, parseTon(900));
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
  it('4. stake without deposit(abnormal)', async () => {
    const adminSigner = await getUser(0);
    const adminAddress = adminSigner.address;

    mining(100);

    await expect(bond.stake()).to.be.reverted;
  });
  it('4. stake with deposit 1000TON(abnormal)', async () => {
    const userSigner = await getUser(1);
    const userAddress = userSigner.address;

    const tonAmount = parseTon(1000);
    ton.mint(userAddress, tonAmount);

    await ton.connect(userSigner).approveAndCall(bond.address, tonAmount, []);
    await expect(bond.stake()).to.be.reverted;
  });
  it('5. stake with deposit 10000TON(normal)', async () => {
    const userSigner = await getUser(1);
    const userAddress = userSigner.address;

    const tonAmount = parseTon(9000);
    ton.mint(userAddress, tonAmount);

    await ton.connect(userSigner).approveAndCall(bond.address, tonAmount, []);
    await bond.stake();
  });
});