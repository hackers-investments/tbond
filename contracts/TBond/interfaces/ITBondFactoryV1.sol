// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;


interface ITBondFactoryV1 {
    function tokens(bytes32 key) external view returns (address token);
}