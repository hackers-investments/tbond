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
import {OnApprove} from "./OnApprove.sol";

/// @title TON/WTON 토큰을 모아서 스테이킹하고 리워드를 분배하는 채권 컨트랙트
/// @author Jeongun Baek (blackcow@hackersinvestments.com)
/// @dev [TODO] ERC20PresetMinterPauser 코드에서 필요없는 코드를 제거하고, 우리 필요한 기능만 넣어서 최적화하는 작업 필요
contract Bond is Ownable, ERC20, OnApprove {
    using SafeERC20 for IERC20;
    address private immutable TON;
    address private immutable WTON;
    address private immutable DEPOSIT_MANAGER;
    uint256 private constant INITIAL_DEPOSIT_TON = 1000e18;
    address private constant LAYER2OPERATOR =
        0x5d9a0646c46245A8a3B4775aFB3c54d07BCB1764;
    uint256 private exchangeRate = 1e18;
    uint256 private targetAmount;
    uint256 private stakingPeriod;
    uint256 private withdrawable;
    uint256 private unstakeable;
    uint256 private stakable;
    address private incentiveTo;
    uint256 private total;

    enum FundStage {
        NONE,
        FUNDRAISING,
        STAKING,
        UNSTAKING,
        END,
        CANCELED
    }
    FundStage public stage;

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
        unchecked {
            _mint(owner(), INITIAL_DEPOSIT_TON);
            total += INITIAL_DEPOSIT_TON;
        }
        // 채권 생성 시 관리자가 필수 참여하도록 설계
        // 관리자는 setup 호출 전 INITIAL_DEPOSIT 만큼 ton 토큰을 approve 해줘야 함
        unchecked {
            stage = FundStage.FUNDRAISING;
            targetAmount = _targetAmount;
            stakingPeriod = _stakingPeriod;
            stakable = block.number + _fundraisingPeriod;
            incentiveTo = _incentiveTo;
        }
    }

    /// @notice 사용자의 지갑에서 TON / WTON을 출금하고 TBOND 발행
    /// @dev TON / WTON의 approveAndCallback에 의해 호출되는 함수
    /// @param sender 사용자 지갑 주소
    /// @param spender TBOND 주소
    /// @param amount TON 또는 WTON 토큰 총량(onApprove를 호출한 컨트랙트에 따라 달라짐)
    /// @param data TON / WTON을 함께 approve 할 때 WTON 토큰 총량(WTON은 미리 approve 해야함)
    function onApprove(
        address sender,
        address spender,
        uint256 amount,
        bytes calldata data
    ) external override onlyRaisingStage returns (bool) {
        require(_msgSender() == TON || _msgSender() == WTON, "Invalid token");

        if (_msgSender() == TON) {
            uint256 amountWton = _decodeApproveData(data);
            IERC20(TON).safeTransferFrom(sender, address(this), amount);
            if (amountWton > 0) {
                IERC20(WTON).safeTransferFrom(
                    sender,
                    address(this),
                    amountWton
                );
                unchecked {
                    _mint(sender, toWAD(amountWton) + amount);
                    total += toWAD(amountWton) + amount;
                }
            } else {
                unchecked {
                    _mint(sender, amount);
                    total += amount;
                }
            }
        } else {
            IERC20(WTON).safeTransferFrom(sender, address(this), amount);
            _mint(sender, toWAD(amount));
            unchecked {
                total += toWAD(amount);
            }
        }

        return true;
    }

    /// @notice 모금된 TON/WTON 토큰을 layer2 operator에게 staking
    function stake() external onlyRaisingStage {
        unchecked {
            require(block.number >= stakable, "not reaching stakable block");
            uint256 tonBalance = IERC20(TON).balanceOf(address(this));
            uint256 wtonBalance = IERC20(WTON).balanceOf(address(this));
            uint256 totalBalance = toWAD(wtonBalance) + tonBalance;
            require(
                totalBalance >= targetAmount,
                "balance not reaching target amount"
            );
            if (wtonBalance != 0) IWTON(WTON).swapToTON(wtonBalance);
            stage = FundStage.STAKING;
            unstakeable = block.number + stakingPeriod;
            bytes memory data = abi.encode(DEPOSIT_MANAGER, LAYER2OPERATOR);
            require(
                ITON(TON).approveAndCall(WTON, totalBalance, data),
                "approveAndCall fail"
            );
        }
        // TONStarter의 contracts/connection/TokamakStaker.sol 컨트랙트 참고
        // 1) TON -> WTON swap
        // 2) DepositManager(plasma-evm-contracts/contracts/stake/managers/DepositManager.sol)의 onApprove method를 통해 staking
    }

    /// @notice staking된 TON을 출금하기 위해 unstaking
    /// @dev staking 후 지정된 블록(stakingPeriod)이 지난 뒤 호출 가능
    function unstake() external {
        require(stage == FundStage.STAKING, "not staked");
        require(unstakeable <= block.number, "not reaching unstakable block");
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
        unchecked {
            withdrawable =
                block.number +
                IDepositManager(DEPOSIT_MANAGER).globalWithdrawalDelay();
        }
    }

    /// @notice 스테이킹된 TON 토큰 출금
    /// @dev unstaking 후 지정된 블록(globalWithdrawalDelay)이 지난 뒤 호출 가능
    /// @dev 2e19 => 스테이킹 이자의 5%
    function withdraw() external {
        require(stage == FundStage.UNSTAKING, "not unstaked");
        require(
            withdrawable <= block.number,
            "not reaching withdrawable block"
        );
        require(
            IDepositManager(DEPOSIT_MANAGER).processRequest(
                LAYER2OPERATOR,
                true
            ),
            "processRequest"
        );
        stage = FundStage.END;
        unchecked {
            uint256 claimedAmount = IERC20(TON).balanceOf(address(this));
            uint256 incentive = wdiv2(claimedAmount - totalSupply(), 2e19);
            IERC20(TON).safeTransfer(incentiveTo, incentive);
            exchangeRate = wdiv2(claimedAmount - incentive, totalSupply());
        }
    }

    /// @notice amount만큼의 TBOND를 burn하고, TON 토큰 반환
    /// @dev 컨트랙트에 쌓인 TON 토큰의 balance가 0일 때는 claim에 실패하기 때문에 호출 전에 balance 확인 필수
    /// @param amount TBOND 토큰 수량
    function claim(uint256 amount) external nonZero(amount) {
        require(stage == FundStage.END, "not withdrawn");
        _burn(_msgSender(), amount);
        IERC20(TON).safeTransfer(_msgSender(), wmul2(amount, exchangeRate));
    }

    /// @notice amount만큼의 TBOND를 burn하고, TON 토큰 반환, 펀드 모금 단계에서 투자를 취소할 때 사용하는 함수
    /// @param amount TBOND 토큰 수량
    function refund(uint256 amount) external nonZero(amount) {
        require(
            stage == FundStage.FUNDRAISING || stage == FundStage.CANCELED,
            "not refundable"
        );
        uint256 tonBalance = IERC20(TON).balanceOf(address(this));
        if (tonBalance < amount)
            IWTON(WTON).swapToTON(IERC20(WTON).balanceOf(address(this)));
        _burn(_msgSender(), amount);
        IERC20(TON).safeTransfer(_msgSender(), amount);
    }

    /// @notice 펀드 모집에 실패했을 때 TBOND의 상태를 취소 상태로 변경, 펀드 모금 단계에서만 호출 가능
    function cancel() external onlyOwner onlyRaisingStage {
        stage = FundStage.CANCELED;
    }

    /// @notice 인센티브를 지급한 지갑 주소 설정
    function setIncentiveTo(address _incentiveTo) external onlyOwner {
        incentiveTo = _incentiveTo;
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

    /// @notice 채권의 상태 정보 반환
    function info()
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            FundStage,
            uint256,
            uint256
        )
    {
        return (
            targetAmount,
            stakable,
            unstakeable,
            withdrawable,
            stage,
            total,
            stakingPeriod
        );
    }

    function bondBalanceOf() external view returns (uint256) {
        return wmul2(balanceOf(_msgSender()), exchangeRate);
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
