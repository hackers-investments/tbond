// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {TBondFundManagerV1} from "./TBondFundManagerV1.sol";

contract TBondFactoryV1 is Ownable {
    mapping (address => bool) public tokens;

    function create(address _registry, string memory name, string memory symbol) onlyOwner external {
        address tbondAddress = address(new TBondFundManagerV1(_registry, name, symbol));
        tokens[tbondAddress] = true;
    }
}