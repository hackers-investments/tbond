const { expect } = require("chai");
const { ethers, network } = require("hardhat");

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

    await getTon(owner, '20');
    ton = await ethers.getContractAt(
      "IERC20",
      TON
    );
    ownerTonBalance = await ton.balanceOf(owner.address);

    await getTon(investor, '10');
    investorTonBalance = await ton.balanceOf(investor.address);
  });

  it("1. create TBondFactoryV1", async function () {
      const Factory = await ethers.getContractFactory("TBondFactoryV1");
      factory = await Factory.deploy();
      await factory.deployed();
  });

  it("2. create TBondFundManagerV1", async function () {
      const key = await factory.getKey(owner.address, "TBOND-22051901", "TBOND");
      await factory.create(TOKAMAK_REGISTRY, "TBOND-22051901", "TBOND");

      const fundManagerAddr = await factory.tokens(key);

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
      await fundManager.setup(LAYER2_ADDRESS,
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
      await fundManager.connect(investor).deposit(investorDepositTonBalance);
      const investorTbondBalance = await fundManager.balanceOf(investor.address);
      expect(ethToFloat(investorTbondBalance)).to.equal(ethToFloat(investorDepositTonBalance));

      await fundManager.stake();
  });

  it("5. check incentive after stake", async function () {
      // stake() method 호출 후 인센티브(0.3%)가 지급되었는지 확인
      const onwerTbondBalanceAfterStake = await fundManager.balanceOf(owner.address);
      const expectedOnwerTbondBalanceAfterStake = ethToFloat(ownerTbondBalanceBeforeStake) + ethToFloat(investorDepositTonBalance) * 0.003;
      expect(ethToFloat(onwerTbondBalanceAfterStake)).to.equal(expectedOnwerTbondBalanceAfterStake);
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
      expect(ethToFloat(investorTonBalanceAfterClaim)).to.above(ethToFloat(investorTonBalance));
  });

  it("9. check owners's balance after withdraw", async function () {
      // claim() method 호출 후 onwer의 잔고가 증가했는지 확인
      const onwerTbondBalance = await fundManager.balanceOf(owner.address);
      await fundManager.connect(owner).claim(onwerTbondBalance);
      const onwerTonBalanceAfterClaim = await ton.balanceOf(owner.address);
      expect(ethToFloat(onwerTonBalanceAfterClaim)).to.above(ethToFloat(ownerTonBalance));
  });

  // Uniswap V3를 통해 amount만큼의 ether를 TON으로 교환
  async function getTon(account, amount) {
    const WETH9 = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';		          // WETH9
    const WTON = '0xc4A11aaf6ea915Ed7Ac194161d2fC9384F15bff2';		          // WTON
    const SWAPROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';		    // Uniswap V3 SwapRouter

    const weth = await ethers.getContractAt(
      WethJson.abi,
      WETH9
    );

    // swap ETH -> WETH
    await weth.connect(account).deposit(overrides={value: ethers.utils.parseEther(amount)});
    let balance = await weth.balanceOf(account.address);
    expect(ethToFloat(balance)).to.equal(parseFloat(amount));

    await weth.connect(account).approve(SWAPROUTER, balance);

    // swap WETH -> WTON
    const swapRouter = await ethers.getContractAt(
      SwapRouterJson.abi,
      SWAPROUTER
    );

    const expiryDate = Math.floor(Date.now() / 1000) + 1200;
    const params = {
      tokenIn: WETH9,
      tokenOut: WTON,
      fee: 3000,
      recipient: account.address,
      deadline: expiryDate,
      amountIn: balance,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    };
    await swapRouter.connect(account).exactInputSingle(params);

    const wton = await ethers.getContractAt(
      "IWTON",
      WTON
    );
    const wtonBalance = await wton.balanceOf(account.address);
    expect(parseInt(ethers.utils.formatUnits(wtonBalance, 27))).to.above(0);

    // swap WTON -> TON
    await wton.connect(account).swapToTON(wtonBalance);

    const ton = await ethers.getContractAt(
      "IERC20",
      TON
    );
    
    let tonBalance = await ton.balanceOf(account.address);
    expect(
      parseFloat(ethers.utils.formatUnits(tonBalance, 18))
    ).to.equal(
      parseFloat(ethers.utils.formatUnits(wtonBalance, 27))
    );

    return tonBalance;
  }
  function ethToFloat(eth)
  {
    return parseFloat(ethers.utils.formatEther(eth));
  }
  });