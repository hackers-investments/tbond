const { expect } = require("chai");
const { ethers } = require("hardhat");
const addresses = require("./addresses.json");
const utils = require("./utils");

describe("Tests for TBondExchangeV1's default operations", function () {
  let key;
  let factory;
  let fundManager;
  let exchange;
  let ton;
  let wton;

  let domain;
  let type;
  let makerOrder;
  let takerOrder;
  let makerSign;
  let takerSign;

  const abiCoder = new ethers.utils.AbiCoder();

  const parseSig = (bytes) => {
    bytes = bytes.substr(2)
    const r = '0x' + bytes.slice(0, 64)
    const s = '0x' + bytes.slice(64, 128)
    const v = parseInt('0x' + bytes.slice(128, 130), 16)
    return {v, r, s}
  }

  before(async () => {
    [owner, maker, taker] = await ethers.getSigners();
    ton = await ethers.getContractAt('IERC20', addresses.tokamak.tokens.TON);
    wton = await ethers.getContractAt('IERC20', addresses.tokamak.tokens.WTON);

    const NAME = "TBOND-22051901";
    const SYMBOL = "TBOND"

    const Factory = await ethers.getContractFactory("TBondFactoryV1");
    factory = await Factory.deploy();
    await factory.deployed();
    await factory.create(addresses.tokamak.network.StakeRegistry, NAME, SYMBOL);

    key = await factory.getKey(owner.address, NAME, SYMBOL);

    const fundManagerAddr = await factory.tokens(key);

    await utils.getTon(owner, '20');
    await ton.approve(fundManagerAddr, ethers.utils.parseEther('10000'));

    fundManager = await ethers.getContractAt("TBondFundManagerV1", fundManagerAddr);
    await fundManager.setup(
      addresses.tokamak.layer2.level19,
      1000, 1000, ethers.utils.parseEther('1000')
    );
  });

  it("1. get TBOND token on maker's account", async function () {
    await utils.getTon(maker, '10');
    await ton.connect(maker).approve(fundManager.address, 1000);
    await fundManager.connect(maker).deposit(1000);
  });

  it("2. get TON token on taker's account", async function () {
    await utils.getWTON(taker, '10');
  });

  it("3. deploy TBondExchangeV1 contract", async function () {
    const Exchange = await ethers.getContractFactory("TBondExchangeV1");
    exchange = await Exchange.deploy(factory.address, addresses.tokamak.tokens.WTON);
    await exchange.deployed();

    // EIP712에 사용되는 domain 구조체
    // TBondExhcnageV1 컨트랙트의 DOMAIN_SEPARATOR와 일치해야함
    domain = {
      name: 'TBOND Exchange',
      version: '1.0',
      chainId: 7777,
      verifyingContract: exchange.address
    };

    // sign 할 데이터의 구조체
    // TBondExchangeV1 컨트랙트의 ORDER_TYPEHASH와 일치해야함
    types = {
      Order: [
          { name: 'owner', type: 'address' },
          { name: 'key', type: 'bytes32' },
          { name: 'amountSellToken', type: 'uint256' },
          { name: 'amountBuyToken', type: 'uint256' },
          { name: 'nonce', type: 'uint256' }

      ]
    };
  });

  it("4. generate Maker's sign", async function () {
    makerOrder = {
      owner: maker.address,
      key: key,
      amountSellToken: 1000,
      amountBuyToken: 1000,
      nonce: (await exchange.nonces(maker.address)).toNumber()
    };

    signature = await maker._signTypedData(domain, types, makerOrder);
    const sig = parseSig(signature);  
    makerSign = abiCoder.encode(['uint8', 'bytes32', 'bytes32'], [sig.v, sig.r, sig.s]);
  });

  it("5. generate Taker's sign", async function () {
    takerOrder = {
      owner: taker.address,
      key: key,
      amountSellToken: 1000,
      amountBuyToken: 1000,
      nonce: (await exchange.nonces(taker.address)).toNumber()
    };

    signature = await taker._signTypedData(domain, types, takerOrder);
    const sig = parseSig(signature);  
    takerSign = abiCoder.encode(['uint8', 'bytes32', 'bytes32'], [sig.v, sig.r, sig.s]);
  });

  it("6. trade", async function () {
    const abiCoder = new ethers.utils.AbiCoder();

    // 판매할 TOND를 TBondExchangeV1 컨트랙트에 approve
    fundManager.connect(maker).approve(exchange.address, 1000);

    // 매수에 사용할 WTON을 TBondExchangeV1 컨트랙트에 approve
    wton.connect(taker).approve(exchange.address, 1000);

    await exchange.connect(taker).executeOrder(
      makerOrder, takerOrder,
      abiCoder.encode(['bytes', 'bytes'], [makerSign, takerSign])
    );

    const balance = await fundManager.balanceOf(taker.address);
    await expect(balance).to.equal(1000);
  });

  it("7. trade(reuse maker's sign)", async function () {
    const abiCoder = new ethers.utils.AbiCoder();

    // 판매할 TOND를 TBondExchangeV1 컨트랙트에 approve
    fundManager.connect(maker).approve(exchange.address, 1000);

    // 매수에 사용할 WTON을 TBondExchangeV1 컨트랙트에 approve
    wton.connect(taker).approve(exchange.address, 1000);

    await expect(exchange.connect(taker).executeOrder(
      makerOrder, takerOrder,
      abiCoder.encode(['bytes', 'bytes'], [makerSign, takerSign])
    )).to.be.revertedWith("TBondExchnageV1:invalid maker's nonce");
  });

  it("8. generate Maker's sign with new nonce", async function () {
    makerOrder = {
      owner: maker.address,
      key: key,
      amountSellToken: 1000,
      amountBuyToken: 1000,
      nonce: (await exchange.nonces(maker.address)).toNumber()
    };

    signature = await maker._signTypedData(domain, types, makerOrder);
    const sig = parseSig(signature);  
    makerSign = abiCoder.encode(['uint8', 'bytes32', 'bytes32'], [sig.v, sig.r, sig.s]);
  });

  it("9. trade(reuse Taker's sign)", async function () {
    const abiCoder = new ethers.utils.AbiCoder();

    // 판매할 TOND를 TBondExchangeV1 컨트랙트에 approve
    fundManager.connect(maker).approve(exchange.address, 1000);

    // 매수에 사용할 WTON을 TBondExchangeV1 컨트랙트에 approve
    wton.connect(taker).approve(exchange.address, 1000);

    await expect(exchange.connect(taker).executeOrder(
      makerOrder, takerOrder,
      abiCoder.encode(['bytes', 'bytes'], [makerSign, takerSign])
    )).to.be.revertedWith("TBondExchnageV1:invalid taker's nonce");
  });
});