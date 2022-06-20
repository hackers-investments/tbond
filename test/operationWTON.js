const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const utils = require("./utils");
const addresses = require("./addresses.json");

const WethJson = require("./weth.json");
const SwapRouterJson = require("./SwapRouter.json");

describe("Default operation test for TBondFactory / TBondFundManager", function () {
  const TOKAMAK_REGISTRY = "0x4Fa71D6964a97c043CA3103407e1B3CD6b5Ab367";  // StakeRegistry
  const LAYER2_ADDRESS = "0x42ccf0769e87cb2952634f607df1c7d62e0bbc52";    // level19
  
  let wton;
  let ton;
  let owner;
  let investor;
  let factory;
  let fundManager;
  let ownerTonBalance;
  let investorWtonBalance;
  let investorDepositWtonBalance;
  let ownerTbondBalanceBeforeStake;

  before(async function () {
    [owner, investor] = await ethers.getSigners();

    await utils.getTon(owner, '20');

    wton = await ethers.getContractAt(
      "IERC20",
      addresses.tokamak.tokens.WTON
    );

    ton = await ethers.getContractAt(
        "IERC20",
        addresses.tokamak.tokens.TON
    );

    ownerTonBalance = await ton.balanceOf(owner.address);

    await utils.getWTON(investor, '10');
    investorWtonBalance = await wton.balanceOf(investor.address);
  });

  it("1. create TBondFactory", async function () {
      const Factory = await ethers.getContractFactory("TBondFactory");
      factory = await Factory.deploy();
      await factory.deployed();
  });

  it("2. create TBondFundManager", async function () {
        await factory.create(addresses.tokamak.network.StakeRegistry);

        const tbondRound = await factory.round();
        const name = "TBOND-" + tbondRound;
        const k = ethers.utils.solidityKeccak256(["string"], [name]);

        const fundManagerAddr = await factory.tokens(k);

      fundManager = await ethers.getContractAt(
          "TBondFundManager",
          fundManagerAddr
      );
  });

  it("3. setup TBondFundManager", async function () {
      const minimumDeposit = await fundManager.minimumDeposit();

      await ton.approve(fundManager.address, minimumDeposit);
      await fundManager.setup(LAYER2_ADDRESS,
          1000,   // fundRaisingPeriod
          10000,  // _stakingPeriod 
          ethers.utils.parseEther('1000') // _minTONAmount
      );
      ownerTbondBalanceBeforeStake = await fundManager.balanceOf(owner.address);
  });

  it("4. stake", async function () {
      // 인센티브를 수령할 account 설정(minimumDeposit을 제외한 물량의 0.3%)
      await fundManager.setIncentiveTo(owner.address);
      const incentiveTo = await fundManager.incentiveTo();
      expect(incentiveTo).to.equal(owner.address);

      // investor account에서 FundManager에 deposit한 WTON만큼 TBOND를 수령하는지 확인
      investorDepositWtonBalance = ethers.utils.parseEther('1000');
      await wton.connect(investor).approve(fundManager.address, investorDepositWtonBalance.mul(10 ** 9));
      await fundManager.connect(investor).depositWTON(investorDepositWtonBalance.mul(10 ** 9));
      const investorTbondBalance = await fundManager.balanceOf(investor.address);
      expect(utils.ethToFloat(investorTbondBalance)).to.equal(utils.ethToFloat(investorDepositWtonBalance));

      await network.provider.send("hardhat_mine", ["0x3e8"]);

      await fundManager.stake();
  });

  it("5. check incentive after stake", async function () {
      // stake() method 호출 후 인센티브(0.3%)가 지급되었는지 확인
      const onwerTbondBalanceAfterStake = await fundManager.balanceOf(owner.address);
      const expectedOnwerTbondBalanceAfterStake = utils.ethToFloat(ownerTbondBalanceBeforeStake) + utils.ethToFloat(investorDepositWtonBalance) * 0.003;
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
      // claim() method 호출 후 investor의 잔고가 증가했는지 확인
      const investorTbondBalance = await fundManager.balanceOf(investor.address);
      await fundManager.connect(investor).claim(investorTbondBalance);
      const investorTonBalanceAfterClaim = await ton.balanceOf(investor.address);
      expect(utils.ethToFloat(investorTonBalanceAfterClaim)).to.above(utils.ethToFloat(investorDepositWtonBalance.div(10 ** 9)));

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