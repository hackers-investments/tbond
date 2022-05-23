const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");

const utils = require("./utils");
const addresses = require("./addresses.json");
const WethJson = require("./weth.json");
const SwapRouterJson = require("./SwapRouter.json");

use(solidity);

describe("Tests for TBondFundManagerV1's misc operations", function () {
  let owner;
  let other;
  let factory;
  let fundManager;
  let key;

  const NAME = "TBOND-220520";
  const SYMBOL = "TBOND";

  before(async () => {
    [owner, other] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const Factory = await ethers.getContractFactory("TBondFactoryV1");
    factory = await Factory.deploy();
    await factory.deployed();

    key = factory.getKey(owner.address, NAME, SYMBOL);
    await factory.create(addresses.tokamak.network.StakeRegistry, NAME, SYMBOL);

    const fundManagerAddress = await factory.tokens(key);
    fundManager = await ethers.getContractAt("TBondFundManagerV1", fundManagerAddress);
  });

  it("1. check if mint() fails on owner's account", async function () {
    await expect(fundManager.mint(owner.address, 1000)).to.be.revertedWith("ERC20PresetMinterPauser: must have minter role to mint");
  });

  it("2. check if pause() fails on owner's account", async function () {
    await expect(fundManager.pause()).to.be.revertedWith("ERC20PresetMinterPauser: must have pauser role to pause");
  });

  it("3. check if changeManager() fails on other's account", async function () {
    await expect(fundManager.connect(other).changeManager(other)).to.be.reverted;
  });

  it("4. check if setIncentiveTo() fails on other's account", async function () {
    await expect(fundManager.connect(other).setIncentiveTo(other)).to.be.reverted;
  });
});