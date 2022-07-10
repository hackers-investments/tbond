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
contract Exchange is Context, EIP712("TBond Exchange", "1.0") {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    address private immutable WTON;
    address private immutable FACTORY;
    mapping(address => mapping(uint256 => bool)) used;
    bytes32 private constant TYPEHASH =
        keccak256(
            "Order(address owner,uint256 bond,uint256 bondAmount,uint256 wtonAmount,uint256 nonce,uint256 deadline)"
        );

    struct Order {
        address owner; // 주문 소유자
        uint256 bond; // TBOND 번호
        uint256 bondAmount; // 매도 TBOND 수량
        uint256 wtonAmount; // 매수 wTON 토큰 수량
        uint256 nonce; // 재사용 방지 nonce
        uint256 deadline; // 주문 만료 기준
    }

    constructor(address factory, address wton) {
        FACTORY = factory;
        WTON = wton;
    }

    /// @notice 거래 실행
    /// @param order 주문 데이터
    /// @param sign 서명
    /// @param proof 검증 데이터
    function executeOrder(
        Order memory order,
        bytes calldata sign,
        bytes32 proof
    ) external {
        require(
            used[order.owner][order.nonce] == false &&
                keccak256(
                    abi.encode(
                        _msgSender(),
                        order.bond,
                        order.bondAmount,
                        order.wtonAmount,
                        order.deadline,
                        order.nonce
                    )
                ) ==
                proof,
            "Invalid order"
        );
        address bond = IFactory(FACTORY).bonds(order.bond);
        require(bond != address(0), "Bond not found");
        address signer = signOrder(order).recover(sign);
        require(signer == order.owner, "Invalid signature");
        require(block.timestamp < order.deadline, "Order expired");
        IERC20(bond).safeTransferFrom(signer, _msgSender(), order.bondAmount);
        IERC20(WTON).safeTransferFrom(_msgSender(), signer, order.wtonAmount);
        unchecked {
            used[signer][order.nonce] = true;
        }
    }

    /// @notice 주문 정보를 사인
    function signOrder(Order memory order) private view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        TYPEHASH,
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
