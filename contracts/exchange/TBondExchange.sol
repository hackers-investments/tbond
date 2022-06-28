// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract EIP712 {
    struct EIP712Domain {
        string name;
        string version;
        uint256 chainId;
        address verifyingContract;
    }

    bytes32 constant EIP712DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );

    bytes32 internal DOMAIN_SEPARATOR;

    function hash(EIP712Domain memory eip712Domain)
        internal
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encode(
                    EIP712DOMAIN_TYPEHASH,
                    keccak256(bytes(eip712Domain.name)),
                    keccak256(bytes(eip712Domain.version)),
                    eip712Domain.chainId,
                    eip712Domain.verifyingContract
                )
            );
    }
}

interface ITBondFactory {
    function bonds(uint256) external view returns (address);
}

/// @title TBond 채권 거래소 컨트랙트
contract TBondExchange is Ownable, EIP712 {
    using SafeERC20 for IERC20;

    address private wton;
    address private factory;
    mapping(address => uint256) public nonces;
    bytes private constant SIGN_PREFIX = "\x19Ethereum Signed Message:\n";
    bytes32 private constant ORDER_TYPEHASH =
        keccak256(
            "Order(address owner,uint256 bond,uint256 bondAmount,uint256 wtonAmount,uint256 nonce)"
        );

    struct Order {
        address owner; // 주문을 생성자 주소
        uint256 bond; // 거래 대상이 TBOND 번호
        uint256 bondAmount; // 판매할 TBOND 수량
        uint256 wtonAmount; // 매수에 사용할 TON 토큰 수량
        uint256 nonce; // sign을 재사용 방지 nonce
    }

    constructor(address _factory, address _wton) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        DOMAIN_SEPARATOR = hash(
            EIP712Domain({
                name: "TBOND Exchange",
                version: "1.0",
                chainId: chainId,
                verifyingContract: address(this)
            })
        );
        factory = _factory;
        wton = _wton;
    }

    /// @notice 주문 데이터 검증 루틴
    /// @param hash hashOrder(Order)
    /// @param owner 주문 데이터를 생성한 사용자 주소
    /// @param signature 매수자가 보낸 매도자 / 매수자의 주문 데이터를 sign 한 값
    function validateOrder(
        bytes32 hash,
        address owner,
        bytes memory signature
    ) private view returns (bool) {
        bytes32 sign = hashToSign(hash);
        // Calculate hash which must be signed
        (uint8 v, bytes32 r, bytes32 s) = abi.decode(
            signature,
            (uint8, bytes32, bytes32)
        );
        // (d): Account-only authentication: ECDSA-signed by owner.
        if (owner == msg.sender) {
            return true;
        }
        // (a): sent by owner
        // ecrecover에 sign(v, r, s)과 sign을 생성하는데 사용한 데이터를 넣으면 signer의 address가 나옴
        if (signature.length > 65 && signature[signature.length - 1] == 0x03) {
            // EthSign byte
            /* (d.1): Old way: order hash signed by owner using the prefixed personal_sign */
            if (
                ecrecover(
                    keccak256(abi.encodePacked(SIGN_PREFIX, "32", sign)),
                    v,
                    r,
                    s
                ) == owner
            ) {
                return true;
            }
        }
        /* (d.2): New way: order hash signed by owner using sign_typed_data */
        else if (ecrecover(sign, v, r, s) == owner) {
            return true;
        }
        return false;
    }

    /// @notice 거래 처리 루틴
    /// @param makerOrder 판매자 주문 정보
    /// @param takerOrder 구매자 주문 정보
    /// @param signatures 판매자와 구매자가 주문 정보를 sign한 값
    function executeOrder(
        Order memory makerOrder,
        Order memory takerOrder,
        bytes memory signatures
    ) external {
        bytes32 makerOrderHash = hashOrder(makerOrder);
        bytes32 takerOrderHash = hashOrder(takerOrder);
        (bytes memory makerSignature, bytes memory takerSignature) = abi.decode(
            signatures,
            (bytes, bytes)
        );
        // TBondFactory를 통해 makerOrder(판매자가 등록한 주문)의 token이 정상적으로 발행된 TBOND인지 확인
        address bond = ITBondFactory(factory).bonds(makerOrder.bond);
        require(bond != address(0));
        require(makerOrder.bond == takerOrder.bond, "Invalide bond");
        require(
            makerOrder.bondAmount == takerOrder.bondAmount,
            "Invalid bondAmount"
        );
        require(
            makerOrder.wtonAmount == takerOrder.wtonAmount,
            "Invalid wtonAmount"
        );
        require(
            makerOrder.nonce == nonces[makerOrder.owner],
            "Invalid maker nonce"
        );
        require(
            takerOrder.nonce == nonces[takerOrder.owner],
            "Invalid taker nonce"
        );
        // 테스트 끝나면 require 하나로 병합해서 Invalid Order로 변경할 계획
        require(
            validateOrder(makerOrderHash, makerOrder.owner, makerSignature)
        );
        require(
            validateOrder(takerOrderHash, takerOrder.owner, takerSignature)
        );
        IERC20(bond).safeTransferFrom(
            makerOrder.owner,
            takerOrder.owner,
            makerOrder.bondAmount
        );
        IERC20(wton).safeTransferFrom(
            takerOrder.owner,
            makerOrder.owner,
            takerOrder.wtonAmount
        );
        unchecked {
            nonces[makerOrder.owner] += 1;
            nonces[takerOrder.owner] += 1;
        }
    }

    /// @notice 사용자에게 할당된 nonce 값 업데이트
    // nonce는 sign을 재사용하는 문제를 해결하기 위해 존재함.
    // 토큰의 거래 가격을 낮추는 경우엔 문제가 없지만, (이 경우 어뷰저가 오히려 높은 가격에 매수하기 때문에...)
    // 가격을 높이게 되면 이전에 낮게 설정한 주문 데이터와 sign을 재사용할 수 있기 때문에 nonce를 업데이트 해야함.
    // NOTE: 주문을 취소하거나, 가격을 높게 변경할 때는 **무조건** updateNonce()를 통해 nonce 값을 변경해야함.
    function updateNonce() private {
        unchecked {
            nonces[_msgSender()]++;
        }
    }

    function hashOrder(Order memory order) private pure returns (bytes32 hash) {
        return
            keccak256(
                abi.encode(
                    ORDER_TYPEHASH,
                    order.owner,
                    order.bond,
                    order.bondAmount,
                    order.wtonAmount,
                    order.nonce
                )
            );
    }

    function hashToSign(bytes32 orderHash) private view returns (bytes32 hash) {
        return
            keccak256(
                abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, orderHash)
            );
    }
}
