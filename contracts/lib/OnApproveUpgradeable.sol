//SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {ERC165StorageUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165StorageUpgradeable.sol";

abstract contract OnApproveUpgradeable is ERC165StorageUpgradeable {
    function __OnApprove_init() internal onlyInitializing {
        __ERC165Storage_init();
        _registerInterface(OnApproveUpgradeable(this).onApprove.selector);
    }

    function onApprove(
        address owner,
        address spender,
        uint256 amount,
        bytes calldata data
    ) external virtual returns (bool);

    function _decodeApproveData(bytes memory data)
        internal
        pure
        returns (uint256 approveData)
    {
        assembly {
            approveData := mload(add(data, 0x20))
        }
    }
}
