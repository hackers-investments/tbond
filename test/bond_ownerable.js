const { ethers } = require('hardhat');
const chai = require('chai');
const { expect } = chai;

require('../utils.js').imports();

describe('Test for BOND contract(Ownerable)', () => {
  let bond;
  it('1. deploy BOND contract', async () => {
    // Bond 컨트랙트 생성
    const Factory = await ethers.getContractFactory('Factory');
    const factory = await Factory.deploy();
    await factory.create(StakeRegistry);
    // Factory 컨트랙트의 bonds 배열에는 생성된 bond 컨트랙트의 주소가 저장되어 있음
    // bonds 배열읜 index는 1부터 시작
    bond = await ethers.getContractAt('Bond', await factory.bonds(1));
  });
  it('2. transferOwnership() with User account(abnormal)', async () => {
    const userSigner = await getUser(1);
    await expect(
      bond.connect(userSigner).transferOwnership(userSigner.address)
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });
  it('3. renounceOwnership() with User account(abnormal)', async () => {
    const userSigner = await getUser(1);
    await expect(
      bond.connect(userSigner).renounceOwnership()
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });
  it('4. transferOwnership() with Admin account(normal)', async () => {
    const userSigner = await getUser(1);
    const userAddress = userSigner.address;
    await bond.transferOwnership(userAddress);

    const owner = await bond.owner();
    expect(owner).to.be.equal(userAddress);
  });
  it('5. transferOwnership() with Admin account after transfer ownership(abnormal)', async () => {
    const adminAddress = (await getUser(0)).address;
    await expect(
      bond.transferOwnership(adminAddress)
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });
  it('6. renounceOwnership() with Admin account after transfer ownership(abnormal)', async () => {
    await expect(
      bond.renounceOwnership()
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });
  it('7. renounceOwnership() with User account after transfer ownership(normal)', async () => {
    const userSigner = await getUser(1);
    await bond.connect(userSigner).renounceOwnership();

    const owner = await bond.owner();
    expect(owner).to.be.equal(ethers.constants.AddressZero);
  });
});