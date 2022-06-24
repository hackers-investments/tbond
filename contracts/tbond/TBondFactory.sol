// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {TBondManager} from "./TBondManager.sol";

contract TBondFactory is Ownable {
    uint256 private round;
    mapping(uint256 => address) public bonds;

    function create(address _registry) external onlyOwner {
        string memory name = string.concat("TBOND-", Strings.toString(++round));
        TBondManager manager = new TBondManager(_registry, name);
        manager.changeManager(_msgSender());
        bonds[round] = address(manager);
    }
}
