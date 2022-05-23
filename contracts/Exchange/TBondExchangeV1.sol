// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {EIP712} from "../libs/EIP712.sol";
import {ITBondFactoryV1} from "../TBond/interfaces/ITBondFactoryV1.sol";

contract TBondExchangeV1 is Ownable, EIP712 {
    using SafeERC20 for IERC20;

    string public constant name = "TBOND Exchange";
    string public constant version = "1.0";
    uint256 public constant chainId = 7777;

    mapping(address => uint256) public nonces;

    /* TBOND 토큰 주소를 보관하고 있는 factory 컨트랙트 주소 */
    address factory;
    address ton;

    bytes internal personalSignPrefix = "\x19Ethereum Signed Message:\n";

    /* 구조체가 변경될 경우 front-end의 코드도 함께 변경해야함 */
    bytes32 constant ORDER_TYPEHASH = keccak256(
        "Order(address owner,bytes32 key,uint256 amountSellToken,uint256 amountBuyToken,uint256 nonce)"
    );

    /* 구조체가 변경될 경우 front-end의 코드도 함께 변경해야함 */
    struct Order {
        /* 주문을 생성한 사용자의 주소 */
        address owner;
        /* 거래 대상이 될 TBOND 주소 */
        bytes32 key;
        /* 판매할 TBOND 수량 */
        uint256 amountSellToken;
        /* 매수에 사용할 TON 토큰 수량 */
        uint256 amountBuyToken;
        /* sign을 재사용하는 행위를 방지하기 위한 nonce 값 */
        uint256 nonce;
    }

    constructor(address _factory, address _ton) {
        /* 구조체가 변경될 경우 front-end의 코드도 함께 변경해야함 */
        DOMAIN_SEPARATOR = hash(EIP712Domain({
            name              : name,
            version           : version,
            chainId           : chainId,
            verifyingContract : address(this)
        }));

        factory = _factory;
        ton = _ton;
    }

    function hashToSign(bytes32 orderHash)
        internal
        view
        returns (bytes32 _hash)
    {
        /* Calculate the string a user must sign. */
        return keccak256(abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            orderHash
        ));
    }

    function hashOrder(Order memory order)
        internal
        pure
        returns (bytes32 _hash)
    {
        /* Per EIP 712. */
        return keccak256(abi.encode(
            ORDER_TYPEHASH,
            order.owner,
            order.key,
            order.amountSellToken,
            order.amountBuyToken,
            order.nonce
        ));
    }

    /** 
     * @dev 주문 데이터가 owner가 생성한게 맞는지 EIP712 sign을 통해 검증
     * @param _hash Order(주문 데이터)를 hashOrder()로 해시한 값
     * @param owner 주문 데이터를 생성한 사용자의 주소(주문 데이터에 포함되어 있음)
     * @param signature 매수자가 보낸 매도자 / 매수자의 주문 데이터를 sign 한 값
     */
    function validateOrderAuthorization(bytes32 _hash, address owner, bytes memory signature)
        internal
        view
        returns (bool)
    {
        /* Calculate hash which must be signed. */
        bytes32 calculatedHashToSign = hashToSign(_hash);
        /* (d): Account-only authentication: ECDSA-signed by owner. */
        (uint8 v, bytes32 r, bytes32 s) = abi.decode(signature, (uint8, bytes32, bytes32));
        /* (a): sent by owner */
        if (owner == msg.sender) {
            return true;
        }

        // ecrecover에 sign(v, r, s)과 sign을 생성하는데 사용한 데이터를 넣으면 signer의 address가 나옴
        if (signature.length > 65 && signature[signature.length-1] == 0x03) { // EthSign byte
            /* (d.1): Old way: order hash signed by owner using the prefixed personal_sign */
            if (ecrecover(keccak256(abi.encodePacked(personalSignPrefix,"32",calculatedHashToSign)), v, r, s) == owner) {
                return true;
            }
        }
        /* (d.2): New way: order hash signed by owner using sign_typed_data */
        else if (ecrecover(calculatedHashToSign, v, r, s) == owner) {
            return true;
        }

        return false;
    }

    /**
     * @dev 구매자의 TON을 판매자에게 전송하고, 판매자의 TBOND를 구매자에게 전송
     * @param makerOrder 판매자의 주문 정보
     * @param takerOrder 구매자의 주문 정보
     * @param signatures 판매자와 구매자가 주문 정보를 sign한 값
     */
    function executeOrder(Order memory makerOrder, Order memory takerOrder, bytes memory signatures) external {
        bytes32 makerOrderHash = hashOrder(makerOrder);
        bytes32 takerOrderHash = hashOrder(takerOrder);
        (bytes memory makerSignature, bytes memory takerSignature) = abi.decode(signatures, (bytes, bytes));

        // TBondFactory를 통해 makerOrder(판매자가 등록한 주문)의 token이 정상적으로 발행된 TBOND인지 확인
        address token = ITBondFactoryV1(factory).tokens(makerOrder.key);
        require(token != address(0));

        require(makerOrder.key == takerOrder.key);
        require(makerOrder.amountSellToken == takerOrder.amountSellToken);
        require(makerOrder.amountBuyToken == takerOrder.amountBuyToken);

        // maker와 taker의 sign으로 Order가 유효한지 검증
        require(validateOrderAuthorization(makerOrderHash, makerOrder.owner, makerSignature));
        require(validateOrderAuthorization(takerOrderHash, takerOrder.owner, takerSignature));

        require(makerOrder.nonce == nonces[makerOrder.owner]);
        require(takerOrder.nonce == nonces[takerOrder.owner]);

        IERC20(token).safeTransferFrom(makerOrder.owner, takerOrder.owner, makerOrder.amountSellToken);
        IERC20(ton).safeTransferFrom(takerOrder.owner, makerOrder.owner, takerOrder.amountBuyToken);

        // 거래가 성공한 경우 sign을 재사용할 수 없도록 nonce 값 업데이트
        unchecked {
            nonces[makerOrder.owner] += 1;
            nonces[takerOrder.owner] += 1;
        }
    }

    /**
     * @dev 사용자에게 할당된 nonce 값 업데이트
     *
     * nonce는 sign을 재사용하는 문제를 해결하기 위해 존재함.
     * 토큰의 거래 가격을 낮추는 경우엔 문제가 없지만, (이 경우 어뷰저가 오히려 높은 가격에 매수하기 때문에...)
     * 가격을 높이게 되면 이전에 낮게 설정한 주문 데이터와 sign을 재사용할 수 있기 때문에 nonce를 업데이트 해야함.
     * NOTE: 주문을 취소하거나, 가격을 높게 변경할 때는 **무조건** updateNonce()를 통해 nonce 값을 변경해야함.
     */ 
    function updateNonce() external {
        unchecked {
            nonces[_msgSender()] += 1;
        }
    }
}