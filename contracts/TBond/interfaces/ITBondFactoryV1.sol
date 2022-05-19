// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;


interface ITBondFactoryV1 {
    function tokens(address token) external view returns (bool exists);
}