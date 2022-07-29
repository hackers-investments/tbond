const { ethers } = require('hardhat');
const chai = require('chai');
const { expect } = chai;

require('../utils.js').imports();

describe('Test for BOND contract(isolated)', () => {
    let factory;
    let ton;
    let wton;
    let bond;
    it('0. clean & initialize', async () => {
        // addr 주소에 TON 토큰 민팅
        await setBalance(WTON, parseEth(5));
        await setBalance(SeigManager, parseEth(5));
        await start_impersonate(WTON);
        await start_impersonate(SeigManager);
        ton = await getContract(TON, WTON);
        wton = await getContract(WTON, SeigManager);

        const signers = await getUser();
        for (let idx = 0; idx < signers.length; idx++) {
            const signer = signers[idx];
            const address = signer.address;

            const wtonBalance = await wton.balanceOf(address);
            await wton.connect(signer).swapToTON(wtonBalance);

            const tonBalance = await ton.balanceOf(address);
            ton.connect(signer).transfer(ZeroAddress, tonBalance);
        }
    });
    it('1. deploy TBONDs', async () => {
        // Bond 컨트랙트 생성
        const Factory = await ethers.getContractFactory('Factory');
        factory = await Factory.deploy();
        await factory.create(StakeRegistry);
        await factory.create(StakeRegistry);
        // Factory 컨트랙트의 bonds 배열에는 생성된 bond 컨트랙트의 주소가 저장되어 있음
        // bonds 배열읜 index는 1부터 시작
        bond = await ethers.getContractAt('Bond', await factory.bonds(1));
    });
    it('2. setup TBOND & check balance', async () => {
        const adminSigner = await getUser(0);
        const adminAddress = adminSigner.address;
        // TBOND 컨트랙트의 INITIAL_DEPOSIT_TON이 변경될 경우 바꿔야함
        await ton.mint(adminAddress, parseTon(1000));
        await ton.connect(adminSigner).approve(bond.address, parseTon(1000));
        await bond.setup(
            100, // _fundraisingPeriod
            100, // _stakingPeriod
            parseTon(10000), // _targetAmount
            adminAddress // _incentiveTo
        );
        const tonBalance = await ton.balanceOf(adminAddress);
        expect(parseInt(fromEth(tonBalance))).to.be.equal(0);

        const bond2 = await ethers.getContractAt('Bond', await factory.bonds(2));
        expect(parseInt(fromEth(await bond2.balanceOf(adminAddress)))).to.be.equal(0);
    });
});
