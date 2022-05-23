const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");

const utils = require("./utils");
const addresses = require("./addresses.json");
const WethJson = require("./weth.json");
const SwapRouterJson = require("./SwapRouter.json");

use(solidity);

describe("Tests for TBondFundManagerV1's stake() method", function () {
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

  it("1. check if stake() fails when called early", async function () {
    const minimumDeposit = await fundManager.minimumDeposit();

    await utils.getTon(owner, '20');

    const ton = await ethers.getContractAt("IERC20", addresses.tokamak.tokens.TON);
    await ton.approve(fundManager.address, minimumDeposit);

    await fundManager.setup(addresses.tokamak.layer2.level19, 1000, 1000, ethers.utils.parseEther('1000'));

    await expect(fundManager.stake()).to.be.reverted;
  });

  it("2. check if stake() succeeds on owner's account", async function () {
    const minimumDeposit = await fundManager.minimumDeposit();

    await utils.getTon(owner, '20');

    const ton = await ethers.getContractAt("IERC20", addresses.tokamak.tokens.TON);
    await ton.approve(fundManager.address, minimumDeposit);

    await fundManager.setup(addresses.tokamak.layer2.level19, 1000, 1000, ethers.utils.parseEther('1000'));

    await network.provider.send("hardhat_mine", ["0x3e8"]);

    await fundManager.stake();
  });

  it("3. check if stake() succeeds on other's account", async function () {
    const minimumDeposit = await fundManager.minimumDeposit();

    await utils.getTon(owner, '20');

    const ton = await ethers.getContractAt("IERC20", addresses.tokamak.tokens.TON);
    await ton.approve(fundManager.address, minimumDeposit);

    await fundManager.setup(addresses.tokamak.layer2.level19, 1000, 1000, ethers.utils.parseEther('1000'));

    await network.provider.send("hardhat_mine", ["0x3e8"]);

    await fundManager.connect(other).stake();
  });
});