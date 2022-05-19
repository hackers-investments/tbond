// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {TBondFundManagerV1} from "./TBondFundManagerV1.sol";

contract TBondFactoryV1 is Ownable {
    mapping (bytes32 => address) public tokens;

    function create(address _registry, bytes32 key, string memory name, string memory symbol)
        onlyOwner
        external
        returns(address tbondAddress)
    {
        require(tokens[key] == address(0), "TBondFactoryV1:alredy exists");
        
        tbondAddress = address(new TBondFundManagerV1(_registry, name, symbol));
        TBondFundManagerV1(tbondAddress).changeManager(_msgSender());

        tokens[key] = tbondAddress;
    }

    function getKey(address owner, string memory name, string memory symbol) public pure returns(bytes32) {
        return keccak256(abi.encodePacked(owner, name, symbol));
    }
}