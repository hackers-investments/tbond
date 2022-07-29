// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Bond} from "./Bond.sol";

contract Factory is Ownable {
    address private bondImplementation;
    uint256 public round;
    mapping(uint256 => address) public bonds;

    constructor() {
        bondImplementation = address(new Bond());
    }

    function create(address _registry) external onlyOwner {
        unchecked {
            address clonedBond = Clones.clone(bondImplementation);
            string memory name = string.concat(
                "TBOND-",
                Strings.toString(++round)
            );

            Bond(clonedBond).initialize(_registry, name);
            Bond(clonedBond).transferOwnership(_msgSender());
            bonds[round] = address(clonedBond);
        }
    }
}
