// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

interface ICandidate {
    function updateSeigniorage() external returns (bool);

    function isLayer2Candidate() external returns (bool);
}
