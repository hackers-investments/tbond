// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

interface ITokamakRegistry {
    function getTokamak()
        external
        view
        returns (
            address,
            address,
            address,
            address,
            address
        );
}
