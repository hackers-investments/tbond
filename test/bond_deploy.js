require('../utils.js').imports();

describe('Deploy Bond', () => {
  it('deploy', async () => {
    const Bond = await ethers.getContractFactory('Bond');
    const bond = await Bond.deploy(StakeRegistry, 'TBOND');
    await bond.deployed();
  });
});
