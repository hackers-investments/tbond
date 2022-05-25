const addresses = require("./addresses.json");
const { ethers } = require("hardhat");

const WethJson = require("./weth.json");
const SwapRouterJson = require("./SwapRouter.json");

const ethToFloat = (eth) => {
  return parseFloat(ethers.utils.formatEther(eth));
}
module.exports.ethToFloat = ethToFloat;

// Uniswap V3를 통해 amount만큼의 ether를 TON으로 교환
module.exports.getTon = async (account, amount) => {
  const weth = await ethers.getContractAt(
    WethJson.abi,
    addresses.tokens.WETH
  );

  // swap ETH -> WETH
  await weth.connect(account).deposit(overrides={value: ethers.utils.parseEther(amount)});
  let balance = await weth.balanceOf(account.address);

  await weth.connect(account).approve(addresses.uniswap.SwapRouter, balance);

  // swap WETH -> WTON
  const swapRouter = await ethers.getContractAt(
    SwapRouterJson.abi,
    addresses.uniswap.SwapRouter
  );

  const expiryDate = Math.floor(Date.now() / 1000) + 1200;
  const params = {
    tokenIn: addresses.tokens.WETH,
    tokenOut: addresses.tokamak.tokens.WTON,
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
    addresses.tokamak.tokens.WTON
  );
  const wtonBalance = await wton.balanceOf(account.address);

  // swap WTON -> TON
  await wton.connect(account).swapToTON(wtonBalance);

  const ton = await ethers.getContractAt(
    "IERC20",
    addresses.tokamak.tokens.TON
  );
  
  let tonBalance = await ton.balanceOf(account.address);

  return tonBalance;
}

module.exports.getWTON = async (account, amount) => {
  const weth = await ethers.getContractAt(
    WethJson.abi,
    addresses.tokens.WETH
  );

  // swap ETH -> WETH
  await weth.connect(account).deposit(overrides={value: ethers.utils.parseEther(amount)});
  let balance = await weth.balanceOf(account.address);

  await weth.connect(account).approve(addresses.uniswap.SwapRouter, balance);

  // swap WETH -> WTON
  const swapRouter = await ethers.getContractAt(
    SwapRouterJson.abi,
    addresses.uniswap.SwapRouter
  );

  const expiryDate = Math.floor(Date.now() / 1000) + 1200;
  const params = {
    tokenIn: addresses.tokens.WETH,
    tokenOut: addresses.tokamak.tokens.WTON,
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
    addresses.tokamak.tokens.WTON
  );
  const wtonBalance = await wton.balanceOf(account.address);

  return wtonBalance;
}