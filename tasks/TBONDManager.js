const addresses = require("../test/addresses.json");

task("getWETH", "deposit ETH to get WETH")
  .addParam("account", "address to receive WETH")
  .addParam("amount", "amount")
  .setAction(async (taskArgs, hre) => {
    const signer = await hre.ethers.getSigner(taskArgs.account);
    const amount = ethers.utils.parseEther(taskArgs.amount);
    const {
      abi: WETH_ABI    
    } = require("../test/weth.json");
    const WETH = await hre.ethers.getContractAt(WETH_ABI, addresses.tokens.WETH);
    await WETH.connect(signer).deposit(overrides={value: amount});
  })

task("getTON", "swap WETH -> WTON & unwrapping WTON -> TON")
  .addParam("account", "address to receive TON")
  .addParam("amount", "amount")
  .setAction(async (taskArgs) => {
    const signer = await hre.ethers.getSigner(taskArgs.account);
    const amount = ethers.utils.parseEther(taskArgs.amount);

    const {
      abi: WETH_ABI    
    } = require("../test/weth.json");
    const WETH = await hre.ethers.getContractAt(WETH_ABI, addresses.tokens.WETH);
    await WETH.connect(signer).approve(addresses.uniswap.SwapRouter, amount);

    const {
      abi: SWAP_ROUTER_ABI
    } = require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json");
    const swapRouter = await hre.ethers.getContractAt(SWAP_ROUTER_ABI, addresses.uniswap.SwapRouter);

    const expiryDate = Math.floor(Date.now() / 1000) + 1200;
    const params = {
      tokenIn: addresses.tokens.WETH,
      tokenOut: addresses.tokamak.tokens.WTON,
      fee: 3000,
      recipient: taskArgs.account,
      deadline: expiryDate,
      amountIn: amount,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    };

    await swapRouter.connect(signer).exactInputSingle(params);

    const WTON = await hre.ethers.getContractAt('IWTON', addresses.tokamak.tokens.WTON);
    const balance = await WTON.balanceOf(taskArgs.account);
    await WTON.connect(signer).swapToTON(balance);
  });

task("deployTBOND", "Deploy TBOND contract")
  .addParam("account", "address of admin")
  .setAction(async (taskArgs) => {
    const signer = await hre.ethers.getSigner(taskArgs.account);
    
    const Factory = await hre.ethers.getContractFactory("TBondFactoryV1");
    const FACTORY = await Factory.connect(signer).deploy();
    await FACTORY.deployed();
    console.log(`FACTORY : ${FACTORY.address}`);

    await FACTORY.connect(signer).create(
      addresses.tokamak.network.StakeRegistry, 
      "TBOND", "TBOND");

    const key = await FACTORY.getKey(signer.address, "TBOND", "TBOND");
    const TBONDAddress = await FACTORY.connect(signer).tokens(key);
    console.log(`TBOND : ${TBONDAddress}`);

    // const {
    //   abi: ERC20_ABI
    // } = require("@openzeppelin/contracts/build/contracts/ERC20.json");
    const ERC20 = await hre.ethers.getContractAt('IERC20', addresses.tokamak.tokens.TON);
    await ERC20.connect(signer).approve(
      TBONDAddress,
      ethers.utils.parseEther("10000")
    );

    const TBOND = await hre.ethers.getContractAt('TBondFundManagerV1', TBONDAddress);
    await TBOND.connect(signer).setup(
      addresses.tokamak.layer2.level19,
      100,
      100,
      ethers.utils.parseEther("10000"));
  })

task("stake", "staking TON")
  .addParam("account", "address of admin")
  .addParam("factory", "address of TBONDFactoryV1 contract")
  .setAction(async (taskArgs) => {
    const signer = await hre.ethers.getSigner(taskArgs.account);
    const FACTORY = await hre.ethers.getContractAt("TBondFactoryV1", taskArgs.factory);
    const key = await FACTORY.getKey(signer.address, "TBOND", "TBOND");
    const TBONDAddress = await FACTORY.tokens(key);
    const TBOND = await hre.ethers.getContractAt('TBondFundManagerV1', TBONDAddress);
    await TBOND.connect(signer).stake(overrides={gasLimit: 10000000});
  })

task("unstake", "unstaking TON")
  .addParam("account", "address of admin")
  .addParam("factory", "address of TBONDFactoryV1 contract")
  .setAction(async (taskArgs) => {
    const signer = await hre.ethers.getSigner(taskArgs.account);
    const FACTORY = await hre.ethers.getContractAt("TBondFactoryV1", taskArgs.factory);
    const key = await FACTORY.getKey(signer.address, "TBOND", "TBOND");
    const TBONDAddress = await FACTORY.tokens(key);
    const TBOND = await hre.ethers.getContractAt('TBondFundManagerV1', TBONDAddress);
    await TBOND.connect(signer).unstake();
  })

task("withdraw", "withdraw TON")
  .addParam("account", "address of admin")
  .addParam("factory", "address of TBONDFactoryV1 contract")
  .setAction(async (taskArgs) => {
    const signer = await hre.ethers.getSigner(taskArgs.account);
    const FACTORY = await hre.ethers.getContractAt("TBondFactoryV1", taskArgs.factory);
    const key = await FACTORY.getKey(signer.address, "TBOND", "TBOND");
    const TBONDAddress = await FACTORY.tokens(key);
    const TBOND = await hre.ethers.getContractAt('TBondFundManagerV1', TBONDAddress);
    await TBOND.connect(signer).withdraw();
  })

task("deployTBONDExchange", "Deploy TBOND Exchange contract")
  .addParam("account", "address of admin")
  .addParam("factory", "address of TBONDFactoryV1 contract")
  .setAction(async (taskArgs) => {
    const signer = await hre.ethers.getSigner(taskArgs.account);
    
    const Exchange = await hre.ethers.getContractFactory("TBondExchangeV1");
    const EXCHANGE = await Exchange.connect(signer).deploy(
      taskArgs.factory, addresses.tokamak.tokens.WTON
    );
    console.log(`EXCHANGE : ${EXCHANGE.address}`);
  })

task("hardhat_mine", "mine blocks")
  .addParam("blocks", "blocks(hex)")
  .setAction(async (taskArgs, hre) => {
    await hre.network.provider.send('hardhat_mine', [taskArgs.blocks]);
  })
module.exports = {};