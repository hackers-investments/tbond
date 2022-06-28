require('../utils.js').imports();

describe('Deploy Exchange', () => {
  it('deploy', async () => {
    const Factory = await ethers.getContractFactory('Factory');
    const factory = await Factory.deploy();
    await factory.deployed();
    const Exchange = await ethers.getContractFactory('Exchange');
    const exchange = await Exchange.deploy(factory.address, WTON);
    await exchange.deployed();
  });
});
