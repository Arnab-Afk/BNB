// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title GhostNameService
 * @notice ENS-like registry for Ghost Privacy Suite — maps `ghost://username` to a stealth address.
 *
 * Users can register a plain-text username that resolves to a Railgun 0zk stealth address
 * (or any off-chain address string) without revealing their on-chain identity.
 *
 * Registration flow:
 *   1. User picks a username (3–32 chars, alphanumeric + hyphens)
 *   2. User calls register(username, stealthAddress) — pays a registration fee in native BNB
 *   3. The registry emits NameRegistered(nameHash, username, stealthAddress)
 *   4. Anyone can call resolve(username) to get the stealth address
 *   5. Owner can update their record or transfer the name to another stealth address
 *
 * @dev  nameHash = keccak256(abi.encodePacked(lowercase(username)))
 *       Name records expire after TTL (default 1 year) and can be renewed or re-registered.
 */
contract GhostNameService {
    // ── Constants ─────────────────────────────────────────────────────────────

    uint256 public constant MIN_NAME_LENGTH = 3;
    uint256 public constant MAX_NAME_LENGTH = 32;
    uint256 public constant DEFAULT_TTL = 365 days;

    // ── State ─────────────────────────────────────────────────────────────────

    address public owner;
    /// @notice Registration fee in wei (default: 0.001 BNB ≈ $0.60)
    uint256 public registrationFee = 0.001 ether;
    /// @notice Renewal fee (lower than registration)
    uint256 public renewalFee = 0.0005 ether;

    struct NameRecord {
        address registrant;     // On-chain address that owns this registration
        string stealthAddress;  // Off-chain address (Railgun 0zk or plain 0x)
        uint256 expiresAt;      // Unix timestamp
    }

    mapping(bytes32 => NameRecord) public records;   // nameHash → record
    mapping(address => bytes32[]) public ownedNames; // registrant → their nameHashes

    // ── Events ────────────────────────────────────────────────────────────────

    event NameRegistered(
        bytes32 indexed nameHash,
        string username,
        string stealthAddress,
        address indexed registrant,
        uint256 expiresAt
    );
    event NameRenewed(bytes32 indexed nameHash, uint256 newExpiresAt);
    event NameUpdated(bytes32 indexed nameHash, string newStealthAddress);
    event NameTransferred(bytes32 indexed nameHash, address indexed newRegistrant);

    // ── Errors ────────────────────────────────────────────────────────────────

    error InvalidNameLength();
    error InvalidNameCharacter();
    error NameAlreadyRegistered();
    error NameNotFound();
    error NameExpired();
    error NotNameOwner();
    error InsufficientFee();
    error WithdrawFailed();

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _owner) {
        owner = _owner;
    }

    // ── Registration ──────────────────────────────────────────────────────────

    /**
     * @notice Register a ghost:// username.
     * @param username       Desired name (3–32 chars, a-z, 0-9, hyphen)
     * @param stealthAddress Railgun 0zk address or plain 0x Ethereum address
     */
    function register(
        string calldata username,
        string calldata stealthAddress
    ) external payable {
        if (msg.value < registrationFee) revert InsufficientFee();

        bytes32 nameHash = _validateAndHash(username);
        NameRecord storage record = records[nameHash];

        // Allow re-registration if expired
        if (record.expiresAt != 0 && record.expiresAt > block.timestamp) {
            revert NameAlreadyRegistered();
        }

        records[nameHash] = NameRecord({
            registrant: msg.sender,
            stealthAddress: stealthAddress,
            expiresAt: block.timestamp + DEFAULT_TTL
        });
        ownedNames[msg.sender].push(nameHash);

        emit NameRegistered(nameHash, username, stealthAddress, msg.sender, block.timestamp + DEFAULT_TTL);
    }

    /**
     * @notice Renew an existing registration for another year.
     */
    function renew(string calldata username) external payable {
        if (msg.value < renewalFee) revert InsufficientFee();
        bytes32 nameHash = keccak256(bytes(_toLower(username)));
        NameRecord storage record = records[nameHash];
        if (record.registrant == address(0)) revert NameNotFound();
        if (record.registrant != msg.sender) revert NotNameOwner();

        record.expiresAt += DEFAULT_TTL;
        emit NameRenewed(nameHash, record.expiresAt);
    }

    /**
     * @notice Update your stealth address.
     */
    function updateStealthAddress(
        string calldata username,
        string calldata newStealthAddress
    ) external {
        bytes32 nameHash = keccak256(bytes(_toLower(username)));
        NameRecord storage record = records[nameHash];
        if (record.registrant == address(0)) revert NameNotFound();
        if (record.registrant != msg.sender) revert NotNameOwner();
        if (record.expiresAt <= block.timestamp) revert NameExpired();

        record.stealthAddress = newStealthAddress;
        emit NameUpdated(nameHash, newStealthAddress);
    }

    // ── Resolution ────────────────────────────────────────────────────────────

    /**
     * @notice Resolve a username to its stealth address.
     * @return stealthAddress  The registered address (empty string if not found or expired)
     * @return expiresAt       Expiry timestamp
     */
    function resolve(string calldata username)
        external
        view
        returns (string memory stealthAddress, uint256 expiresAt)
    {
        bytes32 nameHash = keccak256(bytes(_toLower(username)));
        NameRecord storage record = records[nameHash];
        if (record.expiresAt == 0 || record.expiresAt <= block.timestamp) {
            return ("", 0);
        }
        return (record.stealthAddress, record.expiresAt);
    }

    function isAvailable(string calldata username) external view returns (bool) {
        bytes32 nameHash = keccak256(bytes(_toLower(username)));
        NameRecord storage record = records[nameHash];
        return record.expiresAt == 0 || record.expiresAt <= block.timestamp;
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setFees(uint256 _registrationFee, uint256 _renewalFee) external {
        require(msg.sender == owner, "Not owner");
        registrationFee = _registrationFee;
        renewalFee = _renewalFee;
    }

    function withdraw() external {
        require(msg.sender == owner, "Not owner");
        (bool ok,) = payable(owner).call{value: address(this).balance}("");
        if (!ok) revert WithdrawFailed();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _validateAndHash(string calldata username) internal pure returns (bytes32) {
        bytes memory b = bytes(username);
        if (b.length < MIN_NAME_LENGTH || b.length > MAX_NAME_LENGTH) revert InvalidNameLength();

        bytes memory lower = new bytes(b.length);
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (c >= 0x41 && c <= 0x5A) {
                lower[i] = bytes1(uint8(c) + 32); // uppercase → lowercase
            } else if (
                (c >= 0x61 && c <= 0x7A) || // a-z
                (c >= 0x30 && c <= 0x39) || // 0-9
                c == 0x2D                   // hyphen
            ) {
                lower[i] = c;
            } else {
                revert InvalidNameCharacter();
            }
        }
        return keccak256(lower);
    }

    function _toLower(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory lower = new bytes(b.length);
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (c >= 0x41 && c <= 0x5A) {
                lower[i] = bytes1(uint8(c) + 32);
            } else {
                lower[i] = c;
            }
        }
        return string(lower);
    }
}
