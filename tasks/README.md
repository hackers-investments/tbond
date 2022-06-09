# TBOND Protocol 테스트 절차

## 01. hardhat node 실행
npx hardhat node

## 02. admin 계정에 10,000개 이상의 TON 생성
npx hardhat getWETH --account [adminAddress] --amount 50 --network localhost
npx hardhat getTON --account [adminAddress] --amount 50 --network localhost

## 03. TBOND 컨트랙트 배포
npx hardhat deployTBOND --account [adminAddress] --network localhost 
npx hardhat deployTBONDExchange --factory [factoryAddress] --account [adminAddress] --network localhost

`factoryAddress`는 depolyTBOND task를 실행할 때 출력됨.

## 04. investor 계정에 TON 생성
npx hardhat getWETH --account [investorAddress] --amount 50 --network localhost
npx hardhat getTON --account [investorAddress] --amount 50 --network localhost

## 05. TON deposit
Metamask에서 investor 계정을 import하고, TBOND-frontend에서 TON deposit

## 06. stake() method 실행
npx hardhat hardhat_mine --blocks 0x64
npx hardhat stake --account [adminAddress] --factory [factoryAddress] --network localhost

## 07. unstake() method 실행
npx hardhat hardhat_mine --blocks 0x64
npx hardhat unstake --account [adminAddress] --factory [factoryAddress] --network localhost

## 08. withdraw() method 실행
npx hardhat hardhat_mine --blocks 0x16b76
npx hardhat withdraw --account [adminAddress] --factory [factoryAddress] --network localhost

## 09. TON claim
TBOND-frontend에서 TON claim
