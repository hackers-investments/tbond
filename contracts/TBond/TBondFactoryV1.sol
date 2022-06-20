// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {TBondFundManagerV1} from "./TBondFundManagerV1.sol";

contract TBondFactoryV1 is Ownable {
    mapping (bytes32 => address) public tokens;

    uint256 public round;

    function create(address _registry)
        onlyOwner
        external
    {
        string memory name = string.concat("TBOND-", Strings.toString(++round));

        bytes32 key = keccak256(abi.encodePacked(name));
        require(tokens[key] == address(0), "TBondFactoryV1:alredy exists");

        address tbondAddress = address(new TBondFundManagerV1(_registry, name));
        TBondFundManagerV1(tbondAddress).changeManager(_msgSender());

        tokens[key] = tbondAddress;
    }
}