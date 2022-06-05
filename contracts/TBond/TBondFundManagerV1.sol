// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20PresetMinterPauser } from "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

import {ITON} from "../interfaces/ITON.sol";
import {IWTON} from "../interfaces/IWTON.sol";
import {ICandidate} from "../interfaces/ICandidate.sol";
import {IDepositManager} from "../interfaces/IDepositManager.sol";
import {DSMath} from "../libs/DSMath.sol";

import "hardhat/console.sol";

interface ITokamakRegistry {
    function getTokamak()
        external
        view
        returns (
            address,
            address,
            address,
            address,
            address
        );
}

/// @dev [TODO] ERC20PresetMinterPauser 코드에서 필요없는 코드를 제거하고, 우리 필요한 기능만 넣어서 최적화하는 작업 필요
contract TBondFundManagerV1 is Ownable, ERC20PresetMinterPauser, DSMath {
    using SafeERC20 for IERC20;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    address public ton;
    address public wton;
    address public depositManager;
    address public stakeRegistry;

    uint256 internal exchangeRate;

    enum FundingStatus {
        NONE,
        FUNDRAISING,
        STAKING,
        UNSTAKING,
        END
    }

    FundingStatus fundStatus;

    address public layer2Operator;
    uint256 public stakingPeriod;
    uint256 public minTONAmount;
    uint256 public withdrawBlockNumber;
    uint256 public fundraisingEndBlockNumber;
    uint256 public stakingEndBlockNumber;

    /* FundManager가 동작하기 위해 owner가 예치해야하는 최소한의 TON 수량(10,000 TON) */
    uint256 public constant minimumDeposit = 10000 * (10 ** 18);
    /* 스테이킹이 끝난 뒤 컨트랙트에 쌓인 TON 토큰 수량 */
    uint256 public claimedTONAmount;
    /* 발행된 TBOND 토큰의 수량 */
    uint256 public issuedTbondAmount;
    /* FundManager가 동작하기 위해 owner가 예치해야하는 최소한의 TON 수량 */
    uint256 public operatorDeposit;
    /* 인센티브를 지급할 주소 */
    address public incentiveTo;

    /**
     * @param _registry    Tokamak Network의 주요 변수들이 저장된 컨트랙트(TONStarter의 StakeRegistry)
     * @param name         BOND 토큰의 이름
     * @param symbol       BOND 토큰의 심볼. ex) TBDON-YYMMDDRRR, TBOND-220505001, TBOND-220505002, ...
     */
    constructor(address _registry, string memory name, string memory symbol)
        nonZeroAddress(_registry)
        ERC20PresetMinterPauser(name, symbol)
    {
        stakeRegistry = _registry;
        checkTokamak();

        // owner 계정에서 불필요한 권한 제거
        revokeRole(MINTER_ROLE, _msgSender());
        revokeRole(PAUSER_ROLE, _msgSender());

        // setup, stake, unstake, withdraw method를 호출하기 위한 권한 부여
        grantRole(MANAGER_ROLE, _msgSender());
    }

    modifier nonZero(uint256 _value) {
        require(_value > 0, "TBondFundRaiser: zero");
        _;
    }

    modifier nonZeroAddress(address _addr) {
        require(_addr != address(0), "TBondFundRaiser: zero address");
        _;
    }

    function setIncentiveTo(address _incentiveTo) onlyRole(MANAGER_ROLE) external {
        incentiveTo = _incentiveTo;
    }

    function changeManager(address manager) onlyRole(MANAGER_ROLE) external {
        revokeRole(MANAGER_ROLE, _msgSender());
        grantRole(MANAGER_ROLE, manager);
    }

    /// @dev 컨트랙트 동작에 필요한 Tokamak Network의 컨트랙트의 주소를 읽어옴
    function checkTokamak() public {
        if (ton == address(0)) {
            (
                address _ton,
                address _wton,
                address _depositManager,,
            ) = ITokamakRegistry(stakeRegistry).getTokamak();

            ton = _ton;
            wton = _wton;
            depositManager = _depositManager;
        }
        require(
            ton != address(0) &&
                wton != address(0) &&
                depositManager != address(0),
            "FundManagerV1:tokamak network error"
        );
    }
    
    /**
     * @dev 컨트랙트에 모인 TON을 스테이킹 하기 직전에 1번만 호출되며,
     * 정해진 수수료(0.3%)만큼의 TBOND를 추가 발행해서 지정된 지갑으로 전송
     * @param balance 펀딩된 TON 토큰 수량
     */
    function giveIncentive(uint256 balance) internal {
        // rounding error를 최소화하기 위해 1000000(1e6) 사용
        uint256 incentiveAmount = balance * (1000000 - 997000) / 1000000;
        _mint(incentiveTo, incentiveAmount);
    }

    /**
     * @dev 컨트랙트 동작에 필요한 변수들 초기화하고, 관리자 지갑에서 minimumAmount만큼의 TON 토큰 출금
     * @param _layer2Operator              펀드에 모인 자금을 staking할 오퍼레이터의 컨트랙트 주소
     * @param _fundraisingPeriod           펀드 모금 기간(블록 개수)
     * @param _stakingPeriod               staking 기간(블록 개수)
     * @param _minTONAmount                staking을 시작할 수 있는 최소한의 TON 수량, 펀딩 기간 중에 TON 수량이 확보되지 않으면 claim() method를 통해 반환됨.
     *
     * Requirements:
     *
     * - setup() method를 호출하는 관리자는 minimumAmount만큼의 TON 토큰을 보유하고 있어야 하며,
     * minimumAmount만큼의 TON 토큰을 컨트랙트에 approve 해줘야함
     */
    function setup(
        address _layer2Operator,
        uint256 _fundraisingPeriod,
        uint256 _stakingPeriod,
        uint256 _minTONAmount
    )
        onlyRole(MANAGER_ROLE)
        nonZeroAddress(_layer2Operator)
        nonZero(_fundraisingPeriod)
        nonZero(_stakingPeriod)
        nonZero(_minTONAmount)
        external
    {
        require(fundStatus == FundingStatus.NONE, "FundManagerV1:only be called in NONE");

        // 관리자가 최수 수량(minimumAmount)을 deposit 해서 펀딩에 같이 참여하도록 설계
        IERC20(ton).safeTransferFrom(_msgSender(), address(this), minimumDeposit);
        _mint(_msgSender(), minimumDeposit);

        fundStatus = FundingStatus.FUNDRAISING;
        layer2Operator = _layer2Operator;
        fundraisingEndBlockNumber = block.number + _fundraisingPeriod;
        minTONAmount = _minTONAmount;
        stakingPeriod = _stakingPeriod;
    }

    /**
     * @dev 사용자 지갑에서 amount만큼 TON 토큰을 출금하고 TBOND 토큰 발행
     * @param amount TON 토큰 수량
     *
     * Requirements:
     *
     * - despoit() method 호출 전에 amount만큼의 TON 토큰을 컨트랙트에 approve 해줘야함
     */
    function depositTON(uint256 amount) nonZero(amount) external {
        require(fundStatus == FundingStatus.FUNDRAISING, "FundManagerV1:only be called in FUNDRAISING");

        IERC20(ton).safeTransferFrom(_msgSender(), address(this), amount);

        // 채권 토큰(TBOND-...) mint
        _mint(_msgSender(), amount);
    }

    /**
     * @dev 사용자 지갑에서 amount만큼 WTON 토큰을 출금하고 TBOND 토큰 발행
     * @param amount WTON 토큰 수량
     *
     * Requirements:
     *
     * - despoit() method 호출 전에 amount만큼의 WTON 토큰을 컨트랙트에 approve 해줘야함
     */
    function depositWTON(uint256 amount) nonZero(amount) external {
        require(fundStatus == FundingStatus.FUNDRAISING, "FundManagerV1:only be called in FUNDRAISING");

        IERC20(wton).safeTransferFrom(_msgSender(), address(this), amount);

        // 채권 토큰(TBOND-...) mint
        _mint(_msgSender(), _toWAD(amount));
    }

     /**
     * @dev 사용자 지갑에서 amount만큼 WTON 토큰을 출금하고 TBOND 토큰 발행
     * @param amountTon TON 토큰 수량
     * @param amountWton WTON 토큰 수량
     *
     * Requirements:
     *
     * - despoit() method 호출 전에 amount만큼의 WTON 토큰을 컨트랙트에 approve 해줘야함
     */
    function depositBoth(uint256 amountTon, uint256 amountWton)
        nonZero(amountTon)
        nonZero(amountWton)
        external
    {
        require(fundStatus == FundingStatus.FUNDRAISING, "FundManagerV1:only be called in FUNDRAISING");

        IERC20(ton).safeTransferFrom(_msgSender(), address(this), amountTon);
        IERC20(wton).safeTransferFrom(_msgSender(), address(this), amountWton);

        // 채권 토큰(TBOND-...) mint
        _mint(_msgSender(), amountTon + _toWAD(amountWton));
    }

    /**
     * @dev 컨트랙트에 모인 TON 토큰을 지정된 layer2 operator에게 staking
     *
     * Requirements:
     * 
     * - TON 토큰이 일정 수량(minTONAmount) 이상 펀딩된 경우에만 호출 가능
     *
     * NOTE: 펀딩된 TON 토큰 수량의 0.3%만큼의 TBOND를 추가 발행해서 인센티브로 지급
     */
    function stake() external {
        require(fundStatus == FundingStatus.FUNDRAISING, "FundManagerV1:only be called in FUNDRAISING");
        require(block.number >= fundraisingEndBlockNumber);

        uint wtonBalance = IERC20(wton).balanceOf(address(this));
        uint tonBalance = IERC20(ton).balanceOf(address(this));
        uint totalBalance = _toWAD(wtonBalance) + tonBalance;

        require(totalBalance >= minTONAmount, "FundManagerV1:not enough tokens to stake");

        if (wtonBalance != 0) {
            IWTON(wton).swapToTON(wtonBalance);
        }

        fundStatus = FundingStatus.STAKING;

        // constructor에서 설정되는 stakingPeriod(블록 개수) 동안 스테이킹
        stakingEndBlockNumber = block.number + stakingPeriod;
                
        // 인센티브 TBOND 할당
        if (incentiveTo != address(0))
            giveIncentive(totalBalance - minimumDeposit);

        issuedTbondAmount = totalSupply();

        /// TONStarter의 contracts/connection/TokamakStaker.sol 컨트랙트 참고
        /// 1) TON -> WTON swap
        /// 2) DepositManager(plasma-evm-contracts/contracts/stake/managers/DepositManager.sol)의 onApprove method를 통해 staking
        bytes memory data = abi.encode(depositManager, layer2Operator);
        require(
            ITON(ton).approveAndCall(wton, totalBalance, data),
            "FundManagerV1:approveAndCall fail"
        );
    }

    /**
     * @dev staking된 TON을 출금하기 위해 unstaking
     * 
     * Requirements:
     * 
     * - staking 후 지정된 블록(stakingPeriod)이 지난 뒤 호출 가능
     */
    function unstake() external {
        require(fundStatus == FundingStatus.STAKING, "FundManagerV1:only be called in STAKING");
        require(stakingEndBlockNumber <= block.number, "FundManagerV1:funding is not end yet");
        
        address _layer2Operator = layer2Operator;
        address _depositManager = depositManager;

        // unstake를 하기 전에 commit하는 것을 통해 컨트랙트에 쌓인 시뇨리지 분배
        require(ICandidate(_layer2Operator).updateSeigniorage(), "FundManagerV1: updateSeigniorage");

        fundStatus = FundingStatus.UNSTAKING;

        require(IDepositManager(_depositManager).requestWithdrawalAll(_layer2Operator), "FundManagerV1: requestWithdrawalAll");

        // https://github.com/Onther-Tech/plasma-evm-contracts의 contracts/stake/managers/DepositManager.sol를 참고해서 withdrawDelay 계산
        // withdrawDelay가 변경되면 변경된 이후에 발생한 unstake부터 적용되므로 withdrawDelay 변경은 고려하지 않음
        uint256 globalWithdrawalDelay =
            IDepositManager(_depositManager).globalWithdrawalDelay();
        uint256 localWithdrawalDelay =
            IDepositManager(_depositManager).withdrawalDelay(_layer2Operator);
        uint256 delay = globalWithdrawalDelay > localWithdrawalDelay ? globalWithdrawalDelay : localWithdrawalDelay;
        withdrawBlockNumber = block.number + delay;
    }

    /**
     * @dev 스테이킹된 TON 토큰 출금
     * 
     * Requirements:
     * 
     * - unstaking 후 지정된 블록(withdrawDelay)이 지난 뒤 호출 가능
     */
    function withdraw() external {
        require(fundStatus == FundingStatus.UNSTAKING, "FundManagerV1:only be called in UNSTAKING");
        require(withdrawBlockNumber <= block.number, "FundManagerV1:unstaking is not ended yet");
        
        fundStatus = FundingStatus.END;

        require(IDepositManager(depositManager).processRequest(layer2Operator, true), "FundManagerV1: processRequest");

        claimedTONAmount = IERC20(ton).balanceOf(address(this));

        exchangeRate = wdiv(claimedTONAmount, issuedTbondAmount);
    }

    /**
     * @dev amount만큼의 TBOND를 burn하고, TON 토큰 반환
     *
     * Requirements:
     * 
     * - 펀드 모집에 실패 또는 펀드 종료(withdraw) 이후 호출 가능
     * 
     * @param amount TBOND 토큰 수량
     */  
    function claim(uint256 amount) nonZero(amount) external {
        FundingStatus _fundStatus = fundStatus;
        require(
            _fundStatus == FundingStatus.END ||
                (_fundStatus == FundingStatus.FUNDRAISING &&
                    block.number > fundraisingEndBlockNumber),
            "FundManagerV1:only be called in END or FUNDRAISING was failed");

        _burn(_msgSender(), amount);

        IERC20(ton).safeTransfer(_msgSender(), wmul(amount, exchangeRate));
    }

    /**
     * @dev transform RAY to WAD
     */
    function _toWAD(uint256 v) internal pure returns (uint256) {
        return v / 10 ** 9;
    }
}