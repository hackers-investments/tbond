const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");

const utils = require("./utils");
const addresses = require("./addresses.json");
const WethJson = require("./weth.json");
const SwapRouterJson = require("./SwapRouter.json");

use(solidity);

describe("Tests for TBondFundManagerV1", function () {
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

  it("5. check if setup() succeeds on owner's account with minimumDeposit TON", async function () {
    const minimumDeposit = await fundManager.minimumDeposit();

    await utils.getTon(owner, '20');

    const ton = await ethers.getContractAt("IERC20", addresses.tokamak.tokens.TON);
    await ton.approve(fundManager.address, minimumDeposit);

    await fundManager.setup(addresses.tokamak.layer2.level19, 1000, 1000, ethers.utils.parseEther('1000'));
  });

  it("6. check if setup() fails on owner's account without minimumDeposit TON", async function () {
    await expect(fundManager.setup(addresses.tokamak.layer2.level19, 1000, 1000, ethers.utils.parseEther('1000'))).to.be.reverted;
  });

  it("7. check if setup() succeeds on other's account with minimumDeposit TON", async function () {
    const minimumDeposit = await fundManager.minimumDeposit();

    await utils.getTon(other, '20');

    const ton = await ethers.getContractAt("IERC20", addresses.tokamak.tokens.TON);
    await ton.connect(other).approve(fundManager.address, minimumDeposit);

    await expect(
      fundManager.connect(other).setup(
        addresses.tokamak.layer2.level19,
        1000, 1000, ethers.utils.parseEther('1000')
      )
    ).to.be.reverted;
  });

  it("8. check if setup() fails on other's account without minimumDeposit TON", async function () {
    await expect(
      fundManager.connect(other).setup(
        addresses.tokamak.layer2.level19,
        1000, 1000, ethers.utils.parseEther('1000')
      )
    ).to.be.reverted;
  });
});