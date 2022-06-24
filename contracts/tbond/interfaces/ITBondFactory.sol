// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

interface ITBondFactory {
    function tokens(bytes32 key) external view returns (address token);
}