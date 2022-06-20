const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const utils = require("./utils");
const addresses = require("./addresses.json");

const WethJson = require("./weth.json");
const SwapRouterJson = require("./SwapRouter.json");

describe("Default operation test for TBondFactoryV1 / TBondFundManagerV1", function () {
  const TOKAMAK_REGISTRY = "0x4Fa71D6964a97c043CA3103407e1B3CD6b5Ab367";  // StakeRegistry
  const LAYER2_ADDRESS = "0x42ccf0769e87cb2952634f607df1c7d62e0bbc52";    // level19
  const TON = '0x2be5e8c109e2197D077D13A82dAead6a9b3433C5';               // TON
  
  let ton;
  let owner;
  let investor;
  let factory;
  let fundManager;
  let ownerTonBalance;
  let investorTonBalance;
  let investorDepositTonBalance;
  let ownerTbondBalanceBeforeStake;

  before(async function () {
    [owner, investor] = await ethers.getSigners();

    await utils.getTon(owner, '20');
    ton = await ethers.getContractAt(
      "IERC20",
      TON
    );
    ownerTonBalance = await ton.balanceOf(owner.address);

    await utils.getTon(investor, '10');
    investorTonBalance = await ton.balanceOf(investor.address);
  });

  it("1. create TBondFactoryV1", async function () {
      const Factory = await ethers.getContractFactory("TBondFactoryV1");
      factory = await Factory.deploy();
      await factory.deployed();
  });

  it("2. create TBondFundManagerV1", async function () {
      await factory.create(addresses.tokamak.network.StakeRegistry);

      const tbondRound = await factory.round();
      const name = "TBOND-" + tbondRound;
      const k = ethers.utils.solidityKeccak256(["string"], [name]);

      const fundManagerAddr = await factory.tokens(k);

      fundManager = await ethers.getContractAt(
          "TBondFundManagerV1",
          fundManagerAddr
      );
  });

  it("3. setup TBondFundManagerV1", async function () {
      const minimumDeposit = await fundManager.minimumDeposit();
      const ton = await ethers.getContractAt(
        "IERC20",
        TON
      );
      await ton.approve(fundManager.address, minimumDeposit);
      await fundManager.setup("0x42ccf0769e87cb2952634f607df1c7d62e0bbc52",
          1000,   // fundRaisingPeriod
          10000,  // _stakingPeriod 
          ethers.utils.parseEther('1000') // _minTONAmount
      );
      ownerTbondBalanceBeforeStake = await fundManager.balanceOf(owner.address);
  });

  it("4. stake TON to Tokamak Network", async function () {
      // 인센티브를 수령할 account 설정(minimumDeposit을 제외한 물량의 0.3%)
      await fundManager.setIncentiveTo(owner.address);
      const incentiveTo = await fundManager.incentiveTo();
      expect(incentiveTo).to.equal(owner.address);

      // investor account에서 FundManager에 deposit한 TON만큼 TBOND를 수령하는지 확인
      investorDepositTonBalance = ethers.utils.parseEther('1000');
      await ton.connect(investor).approve(fundManager.address, investorDepositTonBalance);
      await fundManager.connect(investor).depositTON(investorDepositTonBalance);
      const investorTbondBalance = await fundManager.balanceOf(investor.address);
      expect(utils.ethToFloat(investorTbondBalance)).to.equal(utils.ethToFloat(investorDepositTonBalance));

      await network.provider.send("hardhat_mine", ["0x3e8"]);

      await fundManager.stake();
  });

  it("5. check incentive after stake", async function () {
      // stake() method 호출 후 인센티브(0.3%)가 지급되었는지 확인
      const onwerTbondBalanceAfterStake = await fundManager.balanceOf(owner.address);
      const expectedOnwerTbondBalanceAfterStake = utils.ethToFloat(ownerTbondBalanceBeforeStake) + utils.ethToFloat(investorDepositTonBalance) * 0.003;
      expect(utils.ethToFloat(onwerTbondBalanceAfterStake)).to.equal(expectedOnwerTbondBalanceAfterStake);
  });

  it("6. unstake TON from Tokamak Network", async function () {
      // 스테이킹 종료 기간까지 블록 생성, 0x2710(100000)
      await network.provider.send("hardhat_mine", ["0x2710"]);

      await fundManager.unstake();
  });

  it("7. withdraw TON from Tokamak Network", async function () {
      // 출금 대기 기간까지 블록 생성, 0x16b76(93046)
      await network.provider.send("hardhat_mine", ["0x16b76"]);

      await fundManager.withdraw();
  });

  it("8. check investor's balance after withdraw", async function () {
      // claim() method 호출 후 investor의 TON balance가 증가했는지 확인
      const investorTbondBalance = await fundManager.balanceOf(investor.address);
      await fundManager.connect(investor).claim(investorTbondBalance);
      const investorTonBalanceAfterClaim = await ton.balanceOf(investor.address);
      expect(utils.ethToFloat(investorTonBalanceAfterClaim)).to.above(utils.ethToFloat(investorTonBalance));

      // claim() method 호출 후 TBOND balance가 0으로 변경되었는지 확인
      expect(await fundManager.balanceOf(investor.address)).to.equal(0);
  });

  it("9. check owners's balance after withdraw", async function () {
      // claim() method 호출 후 onwer의 잔고가 증가했는지 확인
      const onwerTbondBalance = await fundManager.balanceOf(owner.address);
      await fundManager.connect(owner).claim(onwerTbondBalance);
      const onwerTonBalanceAfterClaim = await ton.balanceOf(owner.address);
      expect(utils.ethToFloat(onwerTonBalanceAfterClaim)).to.above(utils.ethToFloat(ownerTonBalance));

      // claim() method 호출 후 TBOND balance가 0으로 변경되었는지 확인
      expect(await fundManager.balanceOf(owner.address)).to.equal(0);
  });
});