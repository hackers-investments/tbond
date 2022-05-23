const { ethers } = require("hardhat");

describe("Tests for TBondExchangeV1's default operations", function () {
  const TON = "0x2be5e8c109e2197D077D13A82dAead6a9b3433C5";

  it("1. deploy TBondExchangeV1 contract", async function () {
    const Factory = await ethers.getContractFactory("TBondFactoryV1");
    const factory = await Factory.deploy();
    await factory.deployed();

    const Exchange = await ethers.getContractFactory("TBondExchangeV1");
    const exchange = await Exchange.deploy(factory.address, TON);
    await exchange.deployed();
  });
  });