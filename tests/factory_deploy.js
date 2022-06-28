describe('Deploy TbondFactory', () => {
  it('deploy', async function () {
    const Factory = await ethers.getContractFactory('TBondFactory');
    const factory = await Factory.deploy();
    await factory.deployed();
  });
});
