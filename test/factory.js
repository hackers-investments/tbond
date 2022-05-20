const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");


use(solidity);

const TOKAMAK_REGISTRY = "0x4Fa71D6964a97c043CA3103407e1B3CD6b5Ab367";

describe("TBondFactoryV1", () => {
    let owner;
    let factory;

    beforeEach(async function () {
        const Factory = await ethers.getContractFactory("TBondFactoryV1");
        factory = await Factory.deploy();
        await factory.deployed();

        [owner] = await ethers.getSigners();
    });

    it("duplicate TBondFundManagerV1 contract creation ", async function () {
        const Factory = await ethers.getContractFactory("TBondFactoryV1");
        const factory = await Factory.deploy();
        await factory.deployed();

        const NAME = "TBOND-22051901";
        const SYMBOL = "TBOND"

        const key = await factory.getKey(owner.address, NAME, SYMBOL);
        await factory.create(TOKAMAK_REGISTRY, NAME, SYMBOL);
        
        await expect(
            factory.create(TOKAMAK_REGISTRY, NAME, SYMBOL)
        ).to.be.revertedWith('TBondFactoryV1:alredy exists');
    });
  });