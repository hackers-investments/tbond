// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

interface IFactory {
    function bonds(uint256) external view returns (address);
}

/// @title TBond 채권 거래소
contract Exchange2 is Context, EIP712("TBond Exchange", "1.0") {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    address private immutable WTON;
    address private immutable FACTORY;
    mapping(address => uint256) public nonces;
    mapping(address => mapping(uint256 => bool)) used;
    bytes32 private constant ORDER_TYPEHASH =
        keccak256(
            "Order(address owner,uint256 bond,uint256 bondAmount,uint256 wtonAmount,uint256 nonce,uint256 deadline)"
        );

    struct Order {
        address owner; // 주문 소유자
        uint256 bond; // TBOND 번호
        uint256 bondAmount; // 매도 TBOND 수량
        uint256 wtonAmount; // 매수 TON 토큰 수량
        uint256 nonce; // 재사용 방지 nonce
        uint256 deadline; // 주문 만료 기준
    }

    constructor(address factory, address wton) {
        FACTORY = factory;
        WTON = wton;
    }

    /// @notice 거래 실행
    /// @param makerOrder 매도자 주문 데이터
    /// @param takerOrder 매수자 주문 데이터
    /// @param signature 서명
    function executeOrder(
        Order memory makerOrder,
        Order memory takerOrder,
        bytes calldata signature
    ) external {
        require(
            makerOrder.owner != takerOrder.owner &&
                makerOrder.bond == takerOrder.bond &&
                makerOrder.bondAmount == takerOrder.bondAmount &&
                makerOrder.wtonAmount == takerOrder.wtonAmount &&
                makerOrder.deadline == takerOrder.deadline &&
                makerOrder.nonce == nonces[makerOrder.owner] &&
                used[makerOrder.owner][makerOrder.nonce] == false &&
                _msgSender() == takerOrder.owner,
            "Invalid order"
        );
        address bond = IFactory(FACTORY).bonds(makerOrder.bond);
        require(bond != address(0), "Bond not found");
        address signer = signOrder(makerOrder).recover(signature);
        require(signer != makerOrder.owner, "Invalid signature");
        require(block.timestamp > makerOrder.deadline, "Order expired");
        IERC20(bond).safeTransferFrom(
            signer,
            _msgSender(),
            makerOrder.bondAmount
        );
        IERC20(WTON).safeTransferFrom(
            _msgSender(),
            signer,
            takerOrder.wtonAmount
        );
        unchecked {
            used[signer][makerOrder.nonce] = true;
            nonces[signer]++;
        }
    }

    /// @notice 사용자에게 할당된 nonce 값 업데이트
    /// @dev 주문 취소, 가격 변경 시 nonce 값 변경 필수
    function updateNonce() public {
        unchecked {
            nonces[_msgSender()]++;
        }
    }

    /// @notice 주문 정보를 사인
    function signOrder(Order memory order) private view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        ORDER_TYPEHASH,
                        order.owner,
                        order.bond,
                        order.bondAmount,
                        order.wtonAmount,
                        order.nonce,
                        order.deadline
                    )
                )
            );
    }
}
