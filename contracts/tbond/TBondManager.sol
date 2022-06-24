// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ITON} from "../interfaces/ITON.sol";
import {IWTON} from "../interfaces/IWTON.sol";
import {ICandidate} from "../interfaces/ICandidate.sol";
import {ITokamakRegistry} from "../interfaces/ITokamakRegistry.sol";
import {IDepositManager} from "../interfaces/IDepositManager.sol";
import {DSMath} from "../libs/DSMath.sol";

/// @title TON/WTON 토큰을 모아서 스테이킹하고 리워드를 분배하는 채권 컨트랙트
/// @author Jeongun Baek (blackcow@hackersinvestments.com)
/// @dev [TODO] ERC20PresetMinterPauser 코드에서 필요없는 코드를 제거하고, 우리 필요한 기능만 넣어서 최적화하는 작업 필요
contract TBondManager is Ownable, ERC20, DSMath {
    using SafeERC20 for IERC20;

    bytes32 private constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 public constant INITIAL_DEPOSIT = 10000 ether;
    address private ton;
    address private wton;
    address private depositManager;
    uint256 private exchangeRate = 1e18;
    // @dev withdraw() method에서 staking 후 돌려받은 TON에 따라 교환 비율이 변경됨
    address private layer2Operator;
    uint256 private stakingPeriod;
    uint256 private targetAmount;
    uint256 private withdrawBlockNumber;
    uint256 private fundraisingEndBlockNumber;
    uint256 private stakingEndBlockNumber;

    // FundManager가 동작하기 위해 owner가 예치해야하는 최소한의 TON 수량(10,000 TON)
    uint256 private claimedTONAmount;
    // 스테이킹이 끝난 뒤 컨트랙트에 쌓인 TON 토큰 수량
    uint256 private issuedTbondAmount;
    // 발행된 TBOND 토큰의 수량
    uint256 private operatorDeposit;
    // FundManager가 동작하기 위해 owner가 예치해야하는 최소한의 TON 수량
    address public incentiveTo;
    // 인센티브를 지급할 주소

    enum FundStage {
        NONE,
        FUNDRAISING,
        STAKING,
        UNSTAKING,
        END
    }
    FundStage private stage;

    /// @param _registry    Tokamak Network의 정보가 저장된 컨트랙트(TONStarter의 StakeRegistry)
    /// @param name         TBOND 토큰의 이름
    constructor(address _registry, string memory name)
        nonZeroAddress(_registry)
        ERC20(name, "TBOND")
    {
        (ton, wton, depositManager, , ) = ITokamakRegistry(_registry)
            .getTokamak();

        require(
            ton != address(0) &&
                wton != address(0) &&
                depositManager != address(0),
            "tokamak network error"
        );
    }

    modifier nonZero(uint256 _value) {
        require(_value > 0, "no zero");
        _;
    }

    modifier nonZeroAddress(address _addr) {
        require(_addr != address(0), "no zero address");
        _;
    }

    modifier onlyRaisingStage() {
        require(stage == FundStage.FUNDRAISING, "not in raising stage");
        _;
    }

    /// @notice 제3자가 커밋을 허용한 오퍼레이터인지 체크
    modifier nonLayer2Candidate(address candidate) {
        require(
            ICandidate(candidate).isLayer2Candidate() == false,
            "isLayer2Candidate"
        );
        _;
    }

    /// @notice 필수 변수 초기화, 관리자 지갑에서 minimumAmount 수량의 TON 토큰을 채권에 투자
    /// @param _layer2Operator              펀드에 모인 자금을 staking할 오퍼레이터의 컨트랙트 주소, 제3자가 커밋할 수 있는 Candidate만 가능하며, layer2Candidate는 등록할 수 없음.
    /// @param _fundraisingPeriod           펀드 모금 기간(블록 개수)
    /// @param _stakingPeriod               staking 기간(블록 개수)
    /// @param _targetAmount                staking을 시작할 수 있는 최소한의 TON 수량, 펀딩 기간 중에 TON 수량이 확보되지 않으면 claim() method를 통해 반환됨.
    function setup(
        address _layer2Operator,
        uint256 _fundraisingPeriod,
        uint256 _stakingPeriod,
        uint256 _targetAmount
    )
        external
        onlyOwner
        nonZero(_targetAmount)
        nonZero(_stakingPeriod)
        nonZero(_fundraisingPeriod)
        nonZeroAddress(_layer2Operator)
        nonLayer2Candidate(_layer2Operator)
    {
        IERC20(ton).safeTransferFrom(owner(), address(this), INITIAL_DEPOSIT);
        _mint(owner(), INITIAL_DEPOSIT);
        // 채권 생성 시 관리자가 필수 참여하도록 설계
        // 관리자는 setup 호출 전 INITIAL_DEPOSIT 만큼 ton 토큰을 approve 해줘야 함
        stage = FundStage.FUNDRAISING;
        layer2Operator = _layer2Operator;
        fundraisingEndBlockNumber = block.number + _fundraisingPeriod;
        targetAmount = _targetAmount;
        stakingPeriod = _stakingPeriod;
    }

    /// @notice 사용자 지갑에서 amount만큼 TON 토큰을 출금하고 TBOND 토큰 발행
    /// @param amount TON 토큰 수량 / 수량 만큼 approve 필수
    function depositTON(uint256 amount)
        external
        nonZero(amount)
        onlyRaisingStage
    {
        IERC20(ton).safeTransferFrom(_msgSender(), address(this), amount);
        _mint(_msgSender(), amount);
    }

    /// @notice 사용자 지갑에서 amount만큼 WTON 토큰을 출금하고 TBOND 토큰 발행
    /// @param amount WTON 토큰 수량 / 수량 만큼 approve 필수
    function depositWTON(uint256 amount)
        external
        nonZero(amount)
        onlyRaisingStage
    {
        IERC20(wton).safeTransferFrom(_msgSender(), address(this), amount);
        _mint(_msgSender(), _toWAD(amount));
        // WTON은 RAY(1e27) decimal를 사용하기 때문에 WAD(1e18)로 변환해서 TBOND 발행
    }

    /// @notice 사용자 지갑에서 amount만큼 TON/WTON 토큰을 출금하고 TBOND 토큰 발행
    /// @param amountTon TON 토큰 수량 / 수량 만큼 approve 필수
    /// @param amountWton WTON 토큰 수량 / 수량 만큼 approve 필수
    function depositBoth(uint256 amountTon, uint256 amountWton)
        external
        nonZero(amountTon)
        nonZero(amountWton)
        onlyRaisingStage
    {
        IERC20(ton).safeTransferFrom(_msgSender(), address(this), amountTon);
        IERC20(wton).safeTransferFrom(_msgSender(), address(this), amountWton);
        _mint(_msgSender(), amountTon + _toWAD(amountWton));
        // WTON은 RAY(1e27) decimal를 사용하기 때문에 WAD(1e18)로 변환해서 TBOND 발행
    }

    /// @notice 모금된 TON/WTON 토큰을 layer2 operator에게 staking
    /// @dev 펀딩된 TON 토큰 수량의 0.3%만큼의 TBOND를 추가 발행해서 인센티브로 지급
    function stake() external onlyRaisingStage {
        require(
            block.number >= fundraisingEndBlockNumber,
            "not reaching stakingable stage"
        );

        uint256 wtonBalance = IERC20(wton).balanceOf(address(this));
        uint256 tonBalance = IERC20(ton).balanceOf(address(this));
        uint256 totalBalance = _toWAD(wtonBalance) + tonBalance;

        require(
            totalBalance >= targetAmount,
            "balance not reaching target amount"
        );

        if (wtonBalance != 0) IWTON(wton).swapToTON(wtonBalance);
        stage = FundStage.STAKING;
        stakingEndBlockNumber = block.number + stakingPeriod;

        // if (incentiveTo != address(0))
        //     giveIncentive(totalBalance - INITIAL_DEPOSIT);
        // 인센티브 TBOND 할당

        issuedTbondAmount = totalSupply();

        /// TONStarter의 contracts/connection/TokamakStaker.sol 컨트랙트 참고
        /// 1) TON -> WTON swap
        /// 2) DepositManager(plasma-evm-contracts/contracts/stake/managers/DepositManager.sol)의 onApprove method를 통해 staking
        bytes memory data = abi.encode(depositManager, layer2Operator);
        require(
            ITON(ton).approveAndCall(wton, totalBalance, data),
            "approveAndCall fail"
        );
    }

    /// @notice staking된 TON을 출금하기 위해 unstaking
    /// @dev staking 후 지정된 블록(stakingPeriod)이 지난 뒤 호출 가능
    function unstake() external {
        require(stage == FundStage.STAKING, "it's not staked");
        require(
            stakingEndBlockNumber <= block.number,
            "wait for staking period"
        );

        require(
            ICandidate(layer2Operator).updateSeigniorage(),
            "updateSeigniorage"
        );
        // unstake를 하기 전에 commit하는 것을 통해 컨트랙트에 쌓인 시뇨리지 분배

        require(
            IDepositManager(depositManager).requestWithdrawalAll(
                layer2Operator
            ),
            "requestWithdrawalAll"
        );

        stage = FundStage.UNSTAKING;

        uint256 globalWithdrawalDelay = IDepositManager(depositManager)
            .globalWithdrawalDelay();
        uint256 localWithdrawalDelay = IDepositManager(depositManager)
            .withdrawalDelay(layer2Operator);
        uint256 delay = globalWithdrawalDelay > localWithdrawalDelay
            ? globalWithdrawalDelay
            : localWithdrawalDelay;
        // https://github.com/Onther-Tech/plasma-evm-contracts의 contracts/stake/managers/DepositManager.sol를 참고해서 withdrawDelay 계산
        // withdrawDelay가 변경되면 변경된 이후에 발생한 unstake부터 적용되므로 withdrawDelay 변경은 고려하지 않음
        withdrawBlockNumber = block.number + delay;
    }

    /// @notice 스테이킹된 TON 토큰 출금
    /// @dev unstaking 후 지정된 블록(withdrawDelay)이 지난 뒤 호출 가능
    function withdraw() external {
        require(stage == FundStage.UNSTAKING, "it's not unstaked");
        require(withdrawBlockNumber <= block.number, "wait for withraw delay");
        require(
            IDepositManager(depositManager).processRequest(
                layer2Operator,
                true
            ),
            "processRequest"
        );
        stage = FundStage.END;
        claimedTONAmount = IERC20(ton).balanceOf(address(this));
        exchangeRate = wdiv2(claimedTONAmount, issuedTbondAmount);
    }

    /// @notice amount만큼의 TBOND를 burn하고, TON 토큰 반환
    /// @dev 컨트랙트에 쌓인 TON 토큰의 balance가 0일 때는 claim에 실패하기 때문에 호출 전에 balance 확인 필수
    /// @param amount TBOND 토큰 수량
    function claim(uint256 amount) external nonZero(amount) {
        // deposit된 TON/WTON을 스테이킹하기 전에는 exchangeRate가 1로 설정되어 있기 때문에 언제든지 환불 가능
        // TON/WTON이 staking되면 컨트랙트의 balance가 0이기 때문에 트랜잭션이 실패함
        // FundingStatus와 fundraisingEndBlockNumber에 접근하지 않으면 소모되는 gas가 약 6%정도 감소함

        // FundingStatus _fundStatus = fundStatus;
        // require(
        //     _fundStatus == FundingStatus.END ||
        //         (_fundStatus == FundingStatus.FUNDRAISING &&
        //             block.number > fundraisingEndBlockNumber),
        //     "FundManager:only be called in END or FUNDRAISING was failed");

        // burnFrom() method를 사용하면 allowance를 처리하는 과정에서 많은 gas가 소모되기 때문에 _burn() method 사용
        _burn(_msgSender(), amount);
        IERC20(ton).safeTransfer(_msgSender(), wmul2(amount, exchangeRate));
    }

    /// @dev 인센티브를 지급한 지갑 주소 설정
    function setIncentiveTo(address _incentiveTo) external onlyOwner {
        incentiveTo = _incentiveTo;
    }

    function changeManager(address newOwner) external onlyOwner {
        transferOwnership(newOwner);
    }

    /// @dev 오입금된 ERC20 토큰을 반환할 때 사용
    /// @param token 오입금된 ERC20 토큰 주소
    /// @param to 오입금된 ERC20 토큰을 돌려받을 주소
    /// @param amount 전송할 ERC20 토큰의 양
    /// @notice 관리자가 악용하는 것을 방지하기 위해 TON / WTON 전송은 제한됨
    function emergencyRecoveryTransfer(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        require(token != ton && token != wton);
        IERC20(token).safeTransfer(to, amount);
    }

    /// @dev 0.3% TBOND 인센티브를지정된 지갑으로 전송
    /// @param balance 펀딩된 TON 토큰 수량
    function giveIncentive(uint256 balance) private {
        uint256 incentiveAmount = (balance * (1000000 - 997000)) / 1000000;
        // rounding error를 최소화하기 위해 1000000(1e6) 사용
        _mint(incentiveTo, incentiveAmount);
    }

    /// @dev transform RAY(10e27) to WAD(10e18)
    function _toWAD(uint256 v) private pure returns (uint256) {
        return v / 10**9;
    }
}
