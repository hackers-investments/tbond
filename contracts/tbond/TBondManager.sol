// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ITON} from "../interfaces/ITON.sol";
import {IWTON} from "../interfaces/IWTON.sol";
import {ICandidate} from "../interfaces/ICandidate.sol";
import {IDepositManager} from "../interfaces/IDepositManager.sol";
import {ITokamakRegistry} from "../interfaces/ITokamakRegistry.sol";

/// @title TON/WTON 토큰을 모아서 스테이킹하고 리워드를 분배하는 채권 컨트랙트
/// @author Jeongun Baek (blackcow@hackersinvestments.com)
/// @dev [TODO] ERC20PresetMinterPauser 코드에서 필요없는 코드를 제거하고, 우리 필요한 기능만 넣어서 최적화하는 작업 필요
contract TBondManager is Ownable, ERC20 {
    using SafeERC20 for IERC20;

    address private immutable TON;
    address private immutable WTON;
    address private immutable DEPOSIT_MANAGER;
    uint256 public constant INITIAL_DEPOSIT_TON = 1000e18;
    // FundManager가 동작하기 위해 owner가 예치해야하는 최소한의 TON 수량(1000TON)
    address public constant LAYER2OPERATOR =
        0x5d9a0646c46245A8a3B4775aFB3c54d07BCB1764;
    uint256 public exchangeRate = 1e18;
    uint256 public incentive;
    // withdraw() method에서 staking 후 돌려받은 TON에 따라 교환 비율이 변경됨
    uint256 private targetAmount;
    uint256 private stakingPeriod;
    uint256 private fundraisingEndBlock;
    uint256 private withdrawBlock;
    uint256 private stakingEndBlock;
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

    /// @param registry    Tokamak Network의 정보가 저장된 컨트랙트(TONStarter의 StakeRegistry)
    /// @param name         TBOND 토큰의 이름
    constructor(address registry, string memory name)
        nonZeroAddress(registry)
        ERC20(name, "TBOND")
    {
        (TON, WTON, DEPOSIT_MANAGER, , ) = ITokamakRegistry(registry)
            .getTokamak();

        require(
            TON != address(0) &&
                WTON != address(0) &&
                DEPOSIT_MANAGER != address(0),
            "tokamak network error"
        );
    }

    modifier nonZero(uint256 value) {
        require(value > 0, "no zero");
        _;
    }

    modifier nonZeroAddress(address addr) {
        require(addr != address(0), "no zero address");
        _;
    }

    modifier onlyRaisingStage() {
        require(stage == FundStage.FUNDRAISING, "not in raising stage");
        _;
    }

    /// @notice 새로운 채권의 설정 정보 초기화
    /// @param _fundraisingPeriod           펀드 모금 기간(블록 개수)
    /// @param _stakingPeriod               staking 기간(블록 개수)
    /// @param _targetAmount                펀드 모금 목표 금액(TON/WTON), 모금 실패 시 claim() method를 통해 반환 환급
    function setup(
        uint256 _fundraisingPeriod,
        uint256 _stakingPeriod,
        uint256 _targetAmount,
        address _incentiveTo
    )
        external
        onlyOwner
        nonZero(_targetAmount)
        nonZero(_stakingPeriod)
        nonZero(_fundraisingPeriod)
        nonZeroAddress(_incentiveTo)
    {
        IERC20(TON).safeTransferFrom(
            owner(),
            address(this),
            INITIAL_DEPOSIT_TON
        );
        _mint(owner(), INITIAL_DEPOSIT_TON);
        // 채권 생성 시 관리자가 필수 참여하도록 설계
        // 관리자는 setup 호출 전 INITIAL_DEPOSIT 만큼 ton 토큰을 approve 해줘야 함
        stage = FundStage.FUNDRAISING;
        targetAmount = _targetAmount;
        stakingPeriod = _stakingPeriod;
        fundraisingEndBlock = block.number + _fundraisingPeriod;
        incentiveTo = _incentiveTo;
    }

    /// @notice 사용자 지갑에서 amount만큼 TON 토큰을 출금하고 TBOND 토큰 발행
    /// @param amount TON 토큰 수량 / 수량 만큼 approve 필수
    function depositTON(uint256 amount)
        external
        nonZero(amount)
        onlyRaisingStage
    {
        IERC20(TON).safeTransferFrom(_msgSender(), address(this), amount);
        _mint(_msgSender(), amount);
    }

    /// @notice 사용자 지갑에서 amount만큼 WTON 토큰을 출금하고 TBOND 토큰 발행
    /// @param amount WTON 토큰 수량 / 수량 만큼 approve 필수
    function depositWTON(uint256 amount)
        external
        nonZero(amount)
        onlyRaisingStage
    {
        IERC20(WTON).safeTransferFrom(_msgSender(), address(this), amount);
        _mint(_msgSender(), toWAD(amount));
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
        IERC20(TON).safeTransferFrom(_msgSender(), address(this), amountTon);
        IERC20(WTON).safeTransferFrom(_msgSender(), address(this), amountWton);
        _mint(_msgSender(), amountTon + toWAD(amountWton));
        // WTON은 RAY(1e27) decimal를 사용하기 때문에 WAD(1e18)로 변환해서 TBOND 발행
    }

    /// @notice 모금된 TON/WTON 토큰을 layer2 operator에게 staking
    /// @dev 펀딩된 TON 토큰 수량의 0.3%만큼의 TBOND를 추가 발행해서 인센티브로 지급
    function stake() external onlyRaisingStage {
        require(
            block.number >= fundraisingEndBlock,
            "not reaching stakingable stage"
        );

        uint256 tonBalance = IERC20(TON).balanceOf(address(this));
        uint256 wtonBalance = IERC20(WTON).balanceOf(address(this));
        uint256 totalBalance = toWAD(wtonBalance) + tonBalance;

        require(
            totalBalance >= targetAmount,
            "balance not reaching target amount"
        );

        if (wtonBalance != 0) IWTON(WTON).swapToTON(wtonBalance);
        stage = FundStage.STAKING;
        stakingEndBlock = block.number + stakingPeriod;

        bytes memory data = abi.encode(DEPOSIT_MANAGER, LAYER2OPERATOR);
        require(
            ITON(TON).approveAndCall(WTON, totalBalance, data),
            "approveAndCall fail"
        );
        // TONStarter의 contracts/connection/TokamakStaker.sol 컨트랙트 참고
        // 1) TON -> WTON swap
        // 2) DepositManager(plasma-evm-contracts/contracts/stake/managers/DepositManager.sol)의 onApprove method를 통해 staking
    }

    /// @notice staking된 TON을 출금하기 위해 unstaking
    /// @dev staking 후 지정된 블록(stakingPeriod)이 지난 뒤 호출 가능
    function unstake() external {
        require(stage == FundStage.STAKING, "it's not staked");
        require(stakingEndBlock <= block.number, "wait for staking period");
        require(
            ICandidate(LAYER2OPERATOR).updateSeigniorage(),
            "updateSeigniorage"
        ); // unstake를 하기 전에 commit하는 것을 통해 컨트랙트에 쌓인 시뇨리지 분배
        require(
            IDepositManager(DEPOSIT_MANAGER).requestWithdrawalAll(
                LAYER2OPERATOR
            ),
            "requestWithdrawalAll"
        );

        stage = FundStage.UNSTAKING;

        withdrawBlock =
            block.number +
            IDepositManager(DEPOSIT_MANAGER).globalWithdrawalDelay();
    }

    /// @notice 스테이킹된 TON 토큰 출금
    /// @dev unstaking 후 지정된 블록(globalWithdrawalDelay)이 지난 뒤 호출 가능
    function withdraw() external {
        require(stage == FundStage.UNSTAKING, "it's not unstaked");
        require(withdrawBlock <= block.number, "wait for withraw delay");
        require(
            IDepositManager(DEPOSIT_MANAGER).processRequest(
                LAYER2OPERATOR,
                true
            ),
            "processRequest"
        );
        stage = FundStage.END;
        uint256 claimedAmount = IERC20(TON).balanceOf(address(this));
        incentive = wdiv2(claimedAmount - totalSupply(), 2e19);
        IERC20(TON).safeTransfer(incentiveTo, incentive);
        exchangeRate = wdiv2(claimedAmount - incentive, totalSupply());
    }

    /// @notice amount만큼의 TBOND를 burn하고, TON 토큰 반환
    /// @dev 컨트랙트에 쌓인 TON 토큰의 balance가 0일 때는 claim에 실패하기 때문에 호출 전에 balance 확인 필수
    /// @param amount TBOND 토큰 수량
    function claim(uint256 amount) external nonZero(amount) {
        require(
            stage == FundStage.END || stage == FundStage.FUNDRAISING,
            "Non-claimable stage"
        );
        uint256 tonBalance = IERC20(TON).balanceOf(address(this));
        if (tonBalance < amount) {
            IWTON(WTON).swapToTON(
                IERC20(WTON).balanceOf(address(this))
            );
        }
        _burn(_msgSender(), amount);
        IERC20(TON).safeTransfer(_msgSender(), wmul2(amount, exchangeRate));
    }

    /// @notice 인센티브를 지급한 지갑 주소 설정
    function setIncentiveTo(address _incentiveTo) external onlyOwner {
        incentiveTo = _incentiveTo;
    }

    function changeManager(address newOwner) external onlyOwner {
        transferOwnership(newOwner);
    }

    /// @notice 오입금된 토큰을 반환하는 인터페이스
    /// @param token 오입금된 토큰 주소
    /// @param to 오입금된 토큰을 돌려받을 주소
    /// @param amount 전송할 토큰의 양
    /// @dev 관리자가 악용하는 것을 방지하기 위해 TON / WTON 전송은 제한됨
    function emergencyRecoveryTransfer(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        require(token != TON && token != WTON);
        IERC20(token).safeTransfer(to, amount);
    }

    /// @notice transform RAY(10e27) to WAD(10e18)
    function toWAD(uint256 v) private pure returns (uint256) {
        return v / 1e9;
    }

    function mul(uint256 x, uint256 y) private pure returns (uint256 z) {
        require(y == 0 || (z = x * y) / y == x, "math-mul-overflow");
    }

    function wmul2(uint256 x, uint256 y) private pure returns (uint256 z) {
        z = mul(x, y) / 1e18;
    }

    function wdiv2(uint256 x, uint256 y) private pure returns (uint256 z) {
        z = mul(x, 1e18) / y;
    }
}
