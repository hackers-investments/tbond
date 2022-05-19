const { expect } = require("chai");
const { ethers } = require("hardhat");

const TOKAMAK_REGISTRY = "0x4Fa71D6964a97c043CA3103407e1B3CD6b5Ab367";
const LAYER2_ADDRESS = "0x42ccf0769e87cb2952634f607df1c7d62e0bbc52";

describe("Test for TBondFundManagerV1 contract", function () {
    it("", async function () {
        const accounts = await ethers.getSigners();

        const Factory = await ethers.getContractFactory("TBondFactoryV1");
        const factory = await Factory.deploy();
        await factory.deployed();

        const fundManagerAddr = await factory.callStatic.create(TOKAMAK_REGISTRY, "TBOND Token", "TBOND");

        const fundManager = await ethers.getContractAt(
            "TBondFundManagerV1",
            fundManagerAddr
          );

        await fundManager.setup(LAYER2_ADDRESS,
            1000, // fundRaisingPeriod
            1000, // _minTONAmount
            1000  // _stakingPeriod
        );

        await fundManager.setIncentiveTo(accounts[1].address);
    });
  });