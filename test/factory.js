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

    it("1. create TBondFundManagerV1 from unprivileged account", async function () {
        await expect(
            factory.connect(owner2).create(TOKAMAK_REGISTRY)
        ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it("2. check key and token pair", async function () {
        await factory.create(TOKAMAK_REGISTRY);
        const tbondRound = await factory.round();
        const name = "TBOND-" + tbondRound;
        const k = ethers.utils.solidityKeccak256(["string"], [name]);
        const tbond = await ethers.getContractAt(
            "ERC20",
            await factory.tokens(k)
        );

        const _name = await tbond.name();
        const _symbol = await tbond.symbol();
        expect(_name).to.equal(name);
        expect(_symbol).to.equal("TBOND");
    });
});