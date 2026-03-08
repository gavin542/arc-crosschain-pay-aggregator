// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PaymentRouter {
    enum Channel { CCTP_FAST, CCTP_STANDARD, GATEWAY, DIRECT }

    struct Payment {
        address sender;
        Channel channel;
        uint256 amount;
        uint32 srcDomain;
        uint32 dstDomain;
        bytes32 txRef;
        uint256 timestamp;
    }

    Payment[] public payments;
    mapping(address => uint256[]) public userPaymentIds;

    event PaymentRecorded(
        uint256 indexed id,
        address indexed sender,
        Channel channel,
        uint256 amount,
        uint32 srcDomain,
        uint32 dstDomain
    );

    function recordPayment(
        Channel channel,
        uint256 amount,
        uint32 srcDomain,
        uint32 dstDomain,
        bytes32 txRef
    ) external {
        uint256 id = payments.length;
        payments.push(Payment({
            sender: msg.sender,
            channel: channel,
            amount: amount,
            srcDomain: srcDomain,
            dstDomain: dstDomain,
            txRef: txRef,
            timestamp: block.timestamp
        }));
        userPaymentIds[msg.sender].push(id);
        emit PaymentRecorded(id, msg.sender, channel, amount, srcDomain, dstDomain);
    }

    function totalPayments() external view returns (uint256) {
        return payments.length;
    }

    function getPayment(uint256 id) external view returns (Payment memory) {
        return payments[id];
    }

    function getUserPaymentCount(address user) external view returns (uint256) {
        return userPaymentIds[user].length;
    }

    function getUserPaymentId(address user, uint256 index) external view returns (uint256) {
        return userPaymentIds[user][index];
    }
}
