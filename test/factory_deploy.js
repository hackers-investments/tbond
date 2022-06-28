describe('Deploy Factory', () => {
  it('deploy', async () => {
    const Factory = await ethers.getContractFactory('Factory');
    const factory = await Factory.deploy();
    await factory.deployed();
  });
});
