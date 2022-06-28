// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Bond} from "./Bond.sol";

contract Factory is Ownable {
    uint256 public round;
    mapping(uint256 => address) public bonds;

    function create(address _registry) external onlyOwner {
        unchecked {
            string memory name = string.concat(
                "TBOND-",
                Strings.toString(++round)
            );
            Bond bond = new Bond(_registry, name);
            bond.transferOwnership(_msgSender());
            bonds[round] = address(bond);
        }
    }
}
