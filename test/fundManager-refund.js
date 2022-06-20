const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");

const utils = require("./utils");
const addresses = require("./addresses.json");
const WethJson = require("./weth.json");
const SwapRouterJson = require("./SwapRouter.json");

use(solidity);

describe("Tests for TBondFundManagerV1's claim() method(refund)", function () {
  let owner;
  let other;
  let factory;
  let fundManager;
  let key;

  before(async () => {
    [owner, other] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const Factory = await ethers.getContractFactory("TBondFactoryV1");
    factory = await Factory.deploy();
    await factory.deployed();

    await factory.create(addresses.tokamak.network.StakeRegistry);

    const tbondRound = await factory.round();
    const name = "TBOND-" + tbondRound;
    const k = ethers.utils.solidityKeccak256(["string"], [name]);

    const fundManagerAddress = await factory.tokens(k);
    fundManager = await ethers.getContractAt("TBondFundManagerV1", fundManagerAddress);
  });

  it("1. refund", async function () {
    const minimumDeposit = await fundManager.minimumDeposit();

    await utils.getTon(owner, '20');

    const ton = await ethers.getContractAt("IERC20", addresses.tokamak.tokens.TON);
    await ton.approve(fundManager.address, minimumDeposit);

    const tonBalance = await ton.balanceOf(owner.address);
    await fundManager.setup(addresses.tokamak.layer2.level19, 1000, 1000, ethers.utils.parseEther('1000'));
    await fundManager.claim(minimumDeposit);
    const claimTonBalance = await ton.balanceOf(owner.address);

    expect(ethers.utils.formatEther(tonBalance))
        .to.be.equal(ethers.utils.formatEther(claimTonBalance));
  });
});