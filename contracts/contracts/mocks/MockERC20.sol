// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title  MockERC20
/// @notice Simple ERC-20 mock for testing deposits in GhostPool.
/// @dev    FOR LOCAL TESTING ONLY. Has an unrestricted public mint function.
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Mint `amount` tokens to `to`. Anyone can call this in tests.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
