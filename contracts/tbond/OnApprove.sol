//SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {ERC165Storage} from "@openzeppelin/contracts/utils/introspection/ERC165Storage.sol";

abstract contract OnApprove is ERC165Storage {
  constructor() {
    _registerInterface(OnApprove(this).onApprove.selector);
  }

  function onApprove(address owner, address spender, uint256 amount, bytes calldata data) external virtual returns (bool);

  function _decodeApproveData(
        bytes memory data
    ) internal pure returns (uint256 approveData) {
        assembly {
            approveData := mload(add(data, 0x20))
        }
    }
}