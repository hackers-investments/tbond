const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");

use(solidity);

const TOKAMAK_REGISTRY = "0x4Fa71D6964a97c043CA3103407e1B3CD6b5Ab367";

describe("Tests for TBondFactoryV1's default operations", () => {
    let owner1;
    let owner2;
    let factory;

    beforeEach(async function () {
        const Factory = await ethers.getContractFactory("TBondFactoryV1");
        factory = await Factory.deploy();
        await factory.deployed();

        [owner1, owner2] = await ethers.getSigners();
    });

    it("1. duplicate owner / name / symbol TBondFundManagerV1 creation", async function () {
        const NAME = "TBOND-22051901";
        const SYMBOL = "TBOND"

        await factory.create(TOKAMAK_REGISTRY, NAME, SYMBOL);
        
        await expect(
            factory.create(TOKAMAK_REGISTRY, NAME, SYMBOL)
        ).to.be.revertedWith('TBondFactoryV1:alredy exists');
    });

    it("2. create TBondFundManagerV1 from unprivileged account", async function () {
        const NAME = "TBOND-22051901";
        const SYMBOL = "TBOND"

        await factory.create(TOKAMAK_REGISTRY, NAME, SYMBOL);
        await expect(
            factory.connect(owner2).create(TOKAMAK_REGISTRY, NAME, SYMBOL)
        ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it("3. check key and token pair", async function () {
        const NAME = "TBOND-22051901";
        const SYMBOL = "TBOND"

        await factory.create(TOKAMAK_REGISTRY, NAME, SYMBOL);
        const key = await factory.getKey(owner1.address, NAME, SYMBOL);
        const tbond = await ethers.getContractAt(
            "ERC20",
            await factory.tokens(key)
        );

        const name = await tbond.name();
        const symbol = await tbond.symbol();
        expect(name).to.equal(NAME);
        expect(symbol).to.equal(SYMBOL);
    });
});