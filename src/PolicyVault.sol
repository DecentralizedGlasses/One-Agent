// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IAavePool.sol";

contract PolicyVault {
    address public immutable owner;
    address public agent;
    bool public isRevoked;

    uint256 public maxTxAmount;
    uint256 public cooldownPeriod;
    uint256 public healthFactorFloor;
    uint256 public lastExecutionTime;

    address[] private _allowedProtocols;

    IAavePool public aavePool;

    event ExecutionAllowed(address indexed agent, address indexed target, uint256 amount);
    event ExecutionBlocked(address indexed agent, address indexed target, string reason);
    event AgentRevoked(address indexed owner, address indexed agent);
    event AgentReinstated(address indexed owner, address indexed agent);
    event PolicyUpdated(address indexed owner);

    error NotOwner();
    error NotAgent();
    error Revoked();
    error TargetNotAllowed(address target);
    error AmountExceedsLimit(uint256 requested, uint256 limit);
    error CooldownActive(uint256 availableAt, uint256 now_);
    error HealthFactorTooLow(uint256 current, uint256 floor);
    error CallFailed(bytes reason);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(
        address _agent,
        uint256 _maxTxAmount,
        uint256 _cooldownPeriod,
        uint256 _healthFactorFloor,
        address[] memory allowedProtocols,
        address _aavePool
    ) {
        owner = msg.sender;
        agent = _agent;
        maxTxAmount = _maxTxAmount;
        cooldownPeriod = _cooldownPeriod;
        healthFactorFloor = _healthFactorFloor;
        _allowedProtocols = allowedProtocols;
        aavePool = IAavePool(_aavePool);
    }

    function execute(address target, uint256 amount, bytes calldata callData)
        external
        onlyAgent
        returns (bytes memory)
    {
        if (isRevoked) revert Revoked();
        if (!_isAllowed(target)) revert TargetNotAllowed(target);
        if (amount > maxTxAmount) revert AmountExceedsLimit(amount, maxTxAmount);

        uint256 availableAt = lastExecutionTime + cooldownPeriod;
        if (block.timestamp < availableAt) revert CooldownActive(availableAt, block.timestamp);

        // Aave health factor check — getUserAccountData reads Chainlink feeds internally
        if (address(aavePool) != address(0)) {
            (,,,,, uint256 hf) = aavePool.getUserAccountData(owner);
            if (hf < healthFactorFloor) revert HealthFactorTooLow(hf, healthFactorFloor);
        }

        lastExecutionTime = block.timestamp;
        emit ExecutionAllowed(msg.sender, target, amount);

        (bool success, bytes memory result) = target.call{value: amount}(callData);
        if (!success) revert CallFailed(result);
        return result;
    }

    function emergencyRevoke() external onlyOwner {
        isRevoked = true;
        emit AgentRevoked(owner, agent);
    }

    function reinstateAgent() external onlyOwner {
        isRevoked = false;
        emit AgentReinstated(owner, agent);
    }

    function setPolicy(uint256 _maxTxAmount, uint256 _cooldownPeriod, uint256 _healthFactorFloor)
        external
        onlyOwner
    {
        maxTxAmount = _maxTxAmount;
        cooldownPeriod = _cooldownPeriod;
        healthFactorFloor = _healthFactorFloor;
        emit PolicyUpdated(owner);
    }

    function setAllowedProtocols(address[] calldata protocols) external onlyOwner {
        _allowedProtocols = protocols;
    }

    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
    }

    function getAllowedProtocols() external view returns (address[] memory) {
        return _allowedProtocols;
    }

    function getPolicy()
        external
        view
        returns (
            address _agent,
            bool _isRevoked,
            uint256 _maxTxAmount,
            uint256 _cooldownPeriod,
            uint256 _healthFactorFloor,
            uint256 _lastExecutionTime,
            address[] memory _protocols
        )
    {
        return (agent, isRevoked, maxTxAmount, cooldownPeriod, healthFactorFloor, lastExecutionTime, _allowedProtocols);
    }

    function cooldownRemaining() external view returns (uint256) {
        uint256 availableAt = lastExecutionTime + cooldownPeriod;
        return block.timestamp >= availableAt ? 0 : availableAt - block.timestamp;
    }

    function getHealthFactor() external view returns (uint256) {
        if (address(aavePool) == address(0)) return type(uint256).max;
        (,,,,, uint256 hf) = aavePool.getUserAccountData(owner);
        return hf;
    }

    function _isAllowed(address target) internal view returns (bool) {
        address[] memory p = _allowedProtocols;
        for (uint256 i = 0; i < p.length; i++) {
            if (p[i] == target) return true;
        }
        return false;
    }

    receive() external payable {}
}
