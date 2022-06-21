// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {TBondFundManager} from "./TBondFundManager.sol";

contract TBondFactory is Ownable {
    mapping (bytes32 => address) private tokens;

    uint256 private round;

    function create(address _registry)
        onlyOwner
        private
    {
        string memory name = string.concat("TBOND-", Strings.toString(++round));

        bytes32 key = keccak256(abi.encodePacked(name));
        require(tokens[key] == address(0), "TBondFactory:alredy exists");

        address manager = address(new TBondFundManager(_registry, name));
        TBondFundManager(manager).changeManager(_msgSender());

        tokens[key] = manager;
    }
}