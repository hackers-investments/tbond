const { ethers } = require("hardhat");

describe("Test for TBondExchangeV1 contract", function () {
    it("", async function () {
      const Factory = await ethers.getContractFactory("TBondFactoryV1");
      const factory = await Factory.deploy();
      await factory.deployed();

      const Exchange = await ethers.getContractFactory("TBondExchangeV1");
      const exchange = await Exchange.deploy(factory.address, "0x2be5e8c109e2197D077D13A82dAead6a9b3433C5");
      await exchange.deployed();
    });
  });