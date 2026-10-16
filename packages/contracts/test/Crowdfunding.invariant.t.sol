// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Crowdfunding} from "../src/Crowdfunding.sol";
import {MockERC20} from "../src/MockERC20.sol";

contract CrowdfundingHandler is Test {
    Crowdfunding public immutable crowdfunding;
    MockERC20 public immutable token;
    uint256 public immutable campaignId;
    uint256 public immutable deadline;
    address public immutable creator;

    address[3] internal supporters;
    bool public postDeadlinePledgeSucceeded;
    bool public unauthorizedClaimSucceeded;
    uint256 public ghostPledged;
    uint256 public ghostRefunded;

    constructor(
        Crowdfunding crowdfunding_,
        MockERC20 token_,
        uint256 campaignId_,
        uint256 deadline_,
        address creator_
    ) {
        crowdfunding = crowdfunding_;
        token = token_;
        campaignId = campaignId_;
        deadline = deadline_;
        creator = creator_;
        supporters = [makeAddr("invariant-alice"), makeAddr("invariant-bob"), makeAddr("invariant-carol")];

        for (uint256 i = 0; i < supporters.length; ++i) {
            token.mint(supporters[i], 1_000_000 ether);
            vm.prank(supporters[i]);
            token.approve(address(crowdfunding), type(uint256).max);
        }
    }

    function pledge(uint256 supporterSeed, uint256 amount) external {
        address supporter = supporters[supporterSeed % supporters.length];
        uint256 balance = token.balanceOf(supporter);
        if (balance == 0) return;
        amount = bound(amount, 1, balance);
        vm.prank(supporter);
        if (block.timestamp >= deadline) {
            (postDeadlinePledgeSucceeded,) =
                address(crowdfunding).call(abi.encodeCall(Crowdfunding.pledge, (campaignId, amount, 0)));
            return;
        }
        crowdfunding.pledge(campaignId, amount, 0);
        ghostPledged += amount;
    }

    function finalize() external {
        vm.warp(deadline);
    }

    function refund(uint256 supporterSeed) external {
        if (block.timestamp < deadline) return;
        address supporter = supporters[supporterSeed % supporters.length];
        uint256 refundable = crowdfunding.pledgedBy(campaignId, supporter);
        if (refundable == 0) return;
        vm.prank(supporter);
        crowdfunding.claimRefund(campaignId);
        ghostRefunded += refundable;
    }

    function unauthorizedClaim(uint256 callerSeed) external {
        if (block.timestamp < deadline) return;
        address caller = supporters[callerSeed % supporters.length];
        vm.prank(caller);
        (unauthorizedClaimSucceeded,) =
            address(crowdfunding).call(abi.encodeCall(Crowdfunding.claimFunds, (campaignId)));
    }

    function supporterAt(uint256 index) external view returns (address) {
        return supporters[index];
    }
}

contract SuccessfulCampaignHandler is Test {
    Crowdfunding public immutable crowdfunding;
    uint256 public immutable campaignId;
    uint256 public immutable deadline;
    address public immutable creator;
    address public immutable supporter;
    bool public unauthorizedClaimSucceeded;
    bool public refundSucceeded;

    constructor(
        Crowdfunding crowdfunding_,
        uint256 campaignId_,
        uint256 deadline_,
        address creator_,
        address supporter_
    ) {
        crowdfunding = crowdfunding_;
        campaignId = campaignId_;
        deadline = deadline_;
        creator = creator_;
        supporter = supporter_;
    }

    function finalize() external {
        vm.warp(deadline);
    }

    function creatorClaim() external {
        Crowdfunding.Campaign memory campaign = crowdfunding.getCampaign(campaignId);
        if (block.timestamp < deadline || campaign.fundsClaimed) return;
        vm.prank(creator);
        crowdfunding.claimFunds(campaignId);
    }

    function unauthorizedClaim(address caller) external {
        if (block.timestamp < deadline || caller == creator) return;
        vm.prank(caller);
        (unauthorizedClaimSucceeded,) =
            address(crowdfunding).call(abi.encodeCall(Crowdfunding.claimFunds, (campaignId)));
    }

    function supporterRefund() external {
        if (block.timestamp < deadline) return;
        vm.prank(supporter);
        (refundSucceeded,) = address(crowdfunding).call(abi.encodeCall(Crowdfunding.claimRefund, (campaignId)));
    }
}

contract CrowdfundingInvariantTest is StdInvariant, Test {
    Crowdfunding internal crowdfunding;
    MockERC20 internal token;
    CrowdfundingHandler internal handler;
    uint256 internal campaignId;

    function setUp() public {
        token = new MockERC20("Invariant USD", "IUSD");
        address[] memory trustedTokens = new address[](1);
        trustedTokens[0] = address(token);
        crowdfunding = new Crowdfunding(trustedTokens);

        address creator = makeAddr("invariant-creator");
        uint256 deadline = block.timestamp + 30 days;
        Crowdfunding.RewardTierInput[] memory tiers = new Crowdfunding.RewardTierInput[](0);
        vm.prank(creator);
        campaignId = crowdfunding.createCampaign(
            "Invariant campaign",
            "Always fails within handler funding bounds",
            "",
            4_000_000 ether,
            address(token),
            deadline,
            tiers
        );

        handler = new CrowdfundingHandler(crowdfunding, token, campaignId, deadline, creator);
        targetContract(address(handler));
    }

    function invariantGrossPledgesAreNeverSettledMoreThanOnce() public view {
        Crowdfunding.Campaign memory campaign = crowdfunding.getCampaign(campaignId);
        assertEq(campaign.pledged, handler.ghostPledged());
        assertEq(campaign.refunded, handler.ghostRefunded());
        assertLe(campaign.refunded, campaign.pledged);
        assertEq(token.balanceOf(address(crowdfunding)), campaign.pledged - campaign.refunded);
    }

    function invariantRefundableLiabilitiesDoNotExceedGrossPledges() public view {
        uint256 liabilities;
        for (uint256 i = 0; i < 3; ++i) {
            liabilities += crowdfunding.pledgedBy(campaignId, handler.supporterAt(i));
        }
        Crowdfunding.Campaign memory campaign = crowdfunding.getCampaign(campaignId);
        assertEq(liabilities + campaign.refunded, campaign.pledged);
    }

    function invariantFailedCampaignCannotBeClaimedOrReceiveLatePledges() public view {
        Crowdfunding.Campaign memory campaign = crowdfunding.getCampaign(campaignId);
        assertFalse(campaign.fundsClaimed);
        assertFalse(handler.unauthorizedClaimSucceeded());
        assertFalse(handler.postDeadlinePledgeSucceeded());
    }
}

contract SuccessfulCampaignInvariantTest is StdInvariant, Test {
    Crowdfunding internal crowdfunding;
    MockERC20 internal token;
    SuccessfulCampaignHandler internal handler;
    uint256 internal campaignId;
    uint256 internal constant GOAL = 1_000 ether;
    address internal creator = makeAddr("successful-creator");
    address internal supporter = makeAddr("successful-supporter");

    function setUp() public {
        token = new MockERC20("Success USD", "SUSD");
        address[] memory trustedTokens = new address[](1);
        trustedTokens[0] = address(token);
        crowdfunding = new Crowdfunding(trustedTokens);
        uint256 deadline = block.timestamp + 30 days;
        Crowdfunding.RewardTierInput[] memory tiers = new Crowdfunding.RewardTierInput[](0);
        vm.prank(creator);
        campaignId = crowdfunding.createCampaign(
            "Successful invariant campaign", "Funded exactly", "", GOAL, address(token), deadline, tiers
        );
        token.mint(supporter, GOAL);
        vm.startPrank(supporter);
        token.approve(address(crowdfunding), GOAL);
        crowdfunding.pledge(campaignId, GOAL, 0);
        vm.stopPrank();

        handler = new SuccessfulCampaignHandler(crowdfunding, campaignId, deadline, creator, supporter);
        targetContract(address(handler));
    }

    function invariantOnlyCreatorCanSettleAndSuccessfulCampaignCannotRefund() public view {
        Crowdfunding.Campaign memory campaign = crowdfunding.getCampaign(campaignId);
        assertFalse(handler.unauthorizedClaimSucceeded());
        assertFalse(handler.refundSucceeded());
        assertEq(campaign.refunded, 0);
        assertEq(crowdfunding.pledgedBy(campaignId, supporter), GOAL);
        assertEq(token.balanceOf(address(crowdfunding)), campaign.fundsClaimed ? 0 : GOAL);
    }
}
