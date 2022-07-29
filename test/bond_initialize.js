const { ethers } = require('hardhat');
const chai = require('chai');
const { expect } = chai;

require('../utils.js').imports();

describe('Test for BOND contract(initialize)', () => {
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
    it('1. deploy TBOND', async () => {
        // Bond 컨트랙트 생성
        const Factory = await ethers.getContractFactory('Factory');
        const factory = await Factory.deploy();
        await factory.create(StakeRegistry);
        // Factory 컨트랙트의 bonds 배열에는 생성된 bond 컨트랙트의 주소가 저장되어 있음
        // bonds 배열읜 index는 1부터 시작
        bond = await ethers.getContractAt('Bond', await factory.bonds(1));
    });
    it('2. try re-initialize', async () => {
        await expect(bond.initialize(StakeRegistry, 'TBOND')).to.be.revertedWith('Initializable: contract is already initialized');
    });
});
