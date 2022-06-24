// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

interface IDepositManager {
    function globalWithdrawalDelay()
        external
        view
        returns (uint256 withdrawalDelay);

    function withdrawalDelay(address layer2)
        external
        view
        returns (uint256 withdrawalDelay);

    function accStaked(address layer2, address account)
        external
        view
        returns (uint256 wtonAmount);

    function pendingUnstaked(address layer2, address account)
        external
        view
        returns (uint256 wtonAmount);

    function accUnstaked(address layer2, address account)
        external
        view
        returns (uint256 wtonAmount);

    function deposit(address layer2, uint256 amount) external returns (bool);

    function requestWithdrawal(address layer2, uint256 amount)
        external
        returns (bool);

    function processRequest(address layer2, bool receiveTON)
        external
        returns (bool);

    function requestWithdrawalAll(address layer2) external returns (bool);

    function processRequests(
        address layer2,
        uint256 n,
        bool receiveTON
    ) external returns (bool);
}
