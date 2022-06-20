const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");

const utils = require("./utils");
const addresses = require("./addresses.json");
const WethJson = require("./weth.json");
const SwapRouterJson = require("./SwapRouter.json");

use(solidity);

describe("Tests for TBondFundManager's setup() method", function () {
  let owner;
  let other;
  let factory;
  let fundManager;
  let key;

  before(async () => {
    [owner, other] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const Factory = await ethers.getContractFactory("TBondFactory");
    factory = await Factory.deploy();
    await factory.deployed();

    await factory.create(addresses.tokamak.network.StakeRegistry);

    const tbondRound = await factory.round();
    const name = "TBOND-" + tbondRound;
    const k = ethers.utils.solidityKeccak256(["string"], [name]);

    const fundManagerAddress = await factory.tokens(k);
    fundManager = await ethers.getContractAt("TBondFundManager", fundManagerAddress);
  });
  
  it("1. check if setup() succeeds on owner's account with minimumDeposit TON", async function () {
    const minimumDeposit = await fundManager.minimumDeposit();

    await utils.getTon(owner, '20');

    const ton = await ethers.getContractAt("IERC20", addresses.tokamak.tokens.TON);
    await ton.approve(fundManager.address, minimumDeposit);

    await fundManager.setup(addresses.tokamak.layer2.level19, 1000, 1000, ethers.utils.parseEther('1000'));
  });

  it("2. check if setup() fails on owner's account without minimumDeposit TON", async function () {
    await expect(fundManager.setup(addresses.tokamak.layer2.level19, 1000, 1000, ethers.utils.parseEther('1000'))).to.be.reverted;
  });

  it("3. check if setup() succeeds on other's account with minimumDeposit TON", async function () {
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

  it("4. check if setup() fails on other's account without minimumDeposit TON", async function () {
    await expect(
      fundManager.connect(other).setup(
        addresses.tokamak.layer2.level19,
        1000, 1000, ethers.utils.parseEther('1000')
      )
    ).to.be.reverted;
  });
});