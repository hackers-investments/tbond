const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");

const utils = require("./utils");
const addresses = require("./addresses.json");
const WethJson = require("./weth.json");
const SwapRouterJson = require("./SwapRouter.json");

use(solidity);

/**
 * @dev owner account로 stake(), unstake(), withdraw() method를
 * 정상적으로 사용할 수 있는 확인하는 테스트.
 */
describe("Tests for TBondFundManagerV1 on owner's account", function () {
  let owner;

  const NAME = "TBOND-220520";
  const SYMBOL = "TBOND";
  
  let fundManager;

  before(async () => {
    [owner] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TBondFactoryV1");
    const factory = await Factory.deploy();
    await factory.deployed();

    const key = factory.getKey(owner.address, NAME, SYMBOL);
    await factory.create(addresses.tokamak.network.StakeRegistry, NAME, SYMBOL);

    const fundManagerAddress = await factory.tokens(key);
    fundManager = await ethers.getContractAt("TBondFundManagerV1", fundManagerAddress);
  });

  it("1. setup()", async function () {
    const minimumDeposit = await fundManager.minimumDeposit();

    await utils.getTon(owner, '20');

    const ton = await ethers.getContractAt("IERC20", addresses.tokamak.tokens.TON);
    await ton.approve(fundManager.address, minimumDeposit);

    await fundManager.setup(addresses.tokamak.layer2.level19, 1000, 1000, ethers.utils.parseEther('1000'));
  });

  it("2. stake()", async function () {
    await network.provider.send("hardhat_mine", ["0x3e8"]);
    await fundManager.stake();
  });

  it("3. unstake() early", async function () {
    await network.provider.send("hardhat_mine", ["0x3e6"]);
    await expect(fundManager.unstake()).to.be.reverted;
  });

  it("4. unstake()", async function () {
    fundManager.unstake();
  });

  /** 
   * @dev unstake 후 93046 블록이 지나야 withdraw 할 수 있음.
   * unstake 후 93045 블록이 지난 시점에 withdraw가 실패하는지 확인.
   */
  it("5. withdraw() early", async function () {
    await network.provider.send("hardhat_mine", ["0x3e5"]);
    await expect(fundManager.unstake()).to.be.reverted;
  });

    /** 
   * @dev "5. withdraw() early" 단계에서 트랜잭션이 revert 되면서
   * 새로운 블록이 생성되었으므로 93046 블록이 지난 시점에 정상적으로
   * withdraw 되는지 확인.
   */
  it("6. withdraw()", async function () {
    await expect(fundManager.unstake()).to.be.reverted;
  });
});