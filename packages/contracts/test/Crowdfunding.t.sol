// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Crowdfunding} from "../src/Crowdfunding.sol";
import {MockERC20} from "../src/MockERC20.sol";

contract FalseReturnERC20 is ERC20 {
    constructor() ERC20("False", "FALSE") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        return false;
    }
}

contract FailingTransferERC20 is ERC20 {
    bool public failTransfers;

    constructor() ERC20("Failing", "FAIL") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function setFailTransfers(bool fail) external {
        failTransfers = fail;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (failTransfers) return false;
        return super.transfer(to, value);
    }
}

contract FeeERC20 is ERC20 {
    constructor() ERC20("Fee", "FEE") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 10;
            super._update(from, address(0), fee);
            value -= fee;
        }
        super._update(from, to, value);
    }
}

contract ReentrantERC20 is ERC20 {
    address public target;
    bytes public callback;
    bool public attempted;
    bool public callbackSucceeded;

    constructor() ERC20("Reentrant", "REENT") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function configure(address target_, bytes calldata callback_) external {
        target = target_;
        callback = callback_;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        bool result = super.transferFrom(from, to, value);
        if (target != address(0)) {
            attempted = true;
            (callbackSucceeded,) = target.call(callback);
        }
        return result;
    }
}

contract CrowdfundingTest is Test {
    using SafeERC20 for IERC20;

    Crowdfunding internal crowdfunding;
    MockERC20 internal token;
    address internal creator = makeAddr("creator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    uint256 internal constant GOAL = 1_000 ether;
    uint256 internal deadline;

    function setUp() public {
        token = new MockERC20("Test USD", "TUSD");
        address[] memory trustedTokens = new address[](1);
        trustedTokens[0] = address(token);
        crowdfunding = new Crowdfunding(trustedTokens);
        deadline = block.timestamp + 7 days;
        token.mint(alice, 10_000 ether);
        token.mint(bob, 10_000 ether);
        vm.prank(alice);
        token.approve(address(crowdfunding), type(uint256).max);
        vm.prank(bob);
        token.approve(address(crowdfunding), type(uint256).max);
    }

    function testCreateCampaignStoresMetadataAndTiers() public {
        Crowdfunding.RewardTierInput[] memory tiers = _tiers();
        vm.prank(creator);
        uint256 campaignId = crowdfunding.createCampaign(
            "Open source wallet", "Build a safer wallet", "ipfs://image", GOAL, address(token), deadline, tiers
        );

        Crowdfunding.Campaign memory campaign = crowdfunding.getCampaign(campaignId);
        Crowdfunding.RewardTier[] memory storedTiers = crowdfunding.getRewardTiers(campaignId);
        assertEq(campaignId, 1);
        assertEq(campaign.creator, creator);
        assertEq(address(campaign.token), address(token));
        assertEq(campaign.goal, GOAL);
        assertEq(campaign.deadline, deadline);
        assertEq(campaign.title, "Open source wallet");
        assertEq(storedTiers.length, 2);
        assertEq(storedTiers[1].minimumContribution, 100 ether);
        assertEq(uint256(crowdfunding.status(campaignId)), uint256(Crowdfunding.CampaignStatus.Active));
    }

    function testCreateCampaignRejectsZeroGoal() public {
        vm.expectRevert(Crowdfunding.InvalidGoal.selector);
        _createWith(address(token), 0, deadline, _emptyTiers());
    }

    function testCreateCampaignRejectsCurrentOrPastDeadline() public {
        vm.expectRevert(abi.encodeWithSelector(Crowdfunding.InvalidDeadline.selector, block.timestamp, block.timestamp));
        _createWith(address(token), GOAL, block.timestamp, _emptyTiers());
    }

    function testCreateCampaignRejectsUnreasonablyShortOrLongDuration() public {
        uint256 shortDeadline = block.timestamp + crowdfunding.MIN_CAMPAIGN_DURATION() - 1;
        vm.expectRevert(
            abi.encodeWithSelector(
                Crowdfunding.InvalidCampaignDuration.selector,
                crowdfunding.MIN_CAMPAIGN_DURATION() - 1,
                crowdfunding.MIN_CAMPAIGN_DURATION(),
                crowdfunding.MAX_CAMPAIGN_DURATION()
            )
        );
        _createWith(address(token), GOAL, shortDeadline, _emptyTiers());

        uint256 longDuration = crowdfunding.MAX_CAMPAIGN_DURATION() + 1;
        vm.expectRevert(
            abi.encodeWithSelector(
                Crowdfunding.InvalidCampaignDuration.selector,
                longDuration,
                crowdfunding.MIN_CAMPAIGN_DURATION(),
                crowdfunding.MAX_CAMPAIGN_DURATION()
            )
        );
        _createWith(address(token), GOAL, block.timestamp + longDuration, _emptyTiers());
    }

    function testCreateCampaignRejectsExcessiveRewardTiers() public {
        uint256 maximum = crowdfunding.MAX_REWARD_TIERS();
        Crowdfunding.RewardTierInput[] memory tiers = new Crowdfunding.RewardTierInput[](maximum + 1);
        vm.expectRevert(abi.encodeWithSelector(Crowdfunding.TooManyTiers.selector, maximum + 1, maximum));
        _createWith(address(token), GOAL, deadline, tiers);
    }

    function testCreateCampaignRejectsOversizedMetadata() public {
        string memory title = new string(crowdfunding.MAX_TITLE_LENGTH() + 1);
        vm.prank(creator);
        vm.expectRevert(
            abi.encodeWithSelector(
                Crowdfunding.MetadataTooLong.selector,
                crowdfunding.MAX_TITLE_LENGTH() + 1,
                crowdfunding.MAX_TITLE_LENGTH()
            )
        );
        crowdfunding.createCampaign(title, "Description", "", GOAL, address(token), deadline, _emptyTiers());
    }

    function testCreateCampaignRejectsUntrustedToken() public {
        MockERC20 other = new MockERC20("Other", "OTHER");
        vm.expectRevert(abi.encodeWithSelector(Crowdfunding.InvalidToken.selector, address(other)));
        _createWith(address(other), GOAL, deadline, _emptyTiers());
    }

    function testCreateCampaignRejectsInvalidRewardTiers() public {
        Crowdfunding.RewardTierInput[] memory tiers = new Crowdfunding.RewardTierInput[](2);
        tiers[0] = Crowdfunding.RewardTierInput(100 ether, "Large");
        tiers[1] = Crowdfunding.RewardTierInput(10 ether, "Small");
        vm.expectRevert(abi.encodeWithSelector(Crowdfunding.InvalidTier.selector, 1));
        _createWith(address(token), GOAL, deadline, tiers);
    }

    function testPledgeTransfersTokensAndAccumulatesMultiplePledges() public {
        uint256 campaignId = _createDefault(_tiers());
        _pledge(alice, campaignId, 50 ether, 1);
        _pledge(alice, campaignId, 100 ether, 2);

        Crowdfunding.Campaign memory campaign = crowdfunding.getCampaign(campaignId);
        assertEq(campaign.pledged, 150 ether);
        assertEq(crowdfunding.pledgedBy(campaignId, alice), 150 ether);
        assertEq(token.balanceOf(address(crowdfunding)), 150 ether);
    }

    function testPledgeRejectsTierBelowMinimum() public {
        uint256 campaignId = _createDefault(_tiers());
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Crowdfunding.TierMinimumNotMet.selector, 2, 100 ether, 99 ether));
        crowdfunding.pledge(campaignId, 99 ether, 2);
    }

    function testPledgeRejectsAfterAndAtDeadline() public {
        uint256 campaignId = _createDefault(_emptyTiers());
        vm.warp(deadline);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Crowdfunding.CampaignEnded.selector, campaignId));
        crowdfunding.pledge(campaignId, 1 ether, 0);

        vm.warp(deadline + 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Crowdfunding.CampaignEnded.selector, campaignId));
        crowdfunding.pledge(campaignId, 1 ether, 0);
    }

    function testCreatorClaimsAtDeadlineWhenGoalMetExactly() public {
        uint256 campaignId = _createDefault(_emptyTiers());
        _pledge(alice, campaignId, GOAL, 0);
        vm.warp(deadline);
        vm.prank(creator);
        crowdfunding.claimFunds(campaignId);

        assertEq(token.balanceOf(creator), GOAL);
        assertTrue(crowdfunding.getCampaign(campaignId).fundsClaimed);
    }

    function testCreatorCannotClaimEarlyEvenWhenGoalExceeded() public {
        uint256 campaignId = _createDefault(_emptyTiers());
        _pledge(alice, campaignId, GOAL + 1 ether, 0);
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(Crowdfunding.CampaignStillActive.selector, campaignId));
        crowdfunding.claimFunds(campaignId);
    }

    function testUnauthorizedAndDuplicateWithdrawalsRevert() public {
        uint256 campaignId = _createDefault(_emptyTiers());
        _pledge(alice, campaignId, GOAL, 0);
        vm.warp(deadline);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Crowdfunding.Unauthorized.selector, alice));
        crowdfunding.claimFunds(campaignId);

        vm.prank(creator);
        crowdfunding.claimFunds(campaignId);
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(Crowdfunding.FundsAlreadyClaimed.selector, campaignId));
        crowdfunding.claimFunds(campaignId);
    }

    function testMultipleSupportersReceiveFullRefundsOnFailure() public {
        uint256 campaignId = _createDefault(_emptyTiers());
        _pledge(alice, campaignId, 200 ether, 0);
        _pledge(bob, campaignId, 300 ether, 0);
        vm.warp(deadline);

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        crowdfunding.claimRefund(campaignId);
        vm.prank(bob);
        crowdfunding.claimRefund(campaignId);

        assertEq(token.balanceOf(alice), aliceBefore + 200 ether);
        assertEq(crowdfunding.pledgedBy(campaignId, alice), 0);
        Crowdfunding.Campaign memory campaign = crowdfunding.getCampaign(campaignId);
        assertEq(campaign.pledged, 500 ether);
        assertEq(campaign.refunded, 500 ether);
    }

    function testDuplicateRefundAndRefundOnSuccessRevert() public {
        uint256 failedId = _createDefault(_emptyTiers());
        _pledge(alice, failedId, 1 ether, 0);
        vm.warp(deadline);
        vm.prank(alice);
        crowdfunding.claimRefund(failedId);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Crowdfunding.NoRefundAvailable.selector, failedId, alice));
        crowdfunding.claimRefund(failedId);

        deadline = block.timestamp + 1 days;
        uint256 successfulId = _createDefault(_emptyTiers());
        _pledge(bob, successfulId, GOAL + 1, 0);
        vm.warp(deadline);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Crowdfunding.CampaignSucceeded.selector, successfulId));
        crowdfunding.claimRefund(successfulId);
    }

    function testFalseReturnTokenPledgeRevertsWithoutAccountingChange() public {
        FalseReturnERC20 falseToken = new FalseReturnERC20();
        Crowdfunding target = _deployFor(address(falseToken));
        falseToken.mint(alice, 100 ether);
        vm.prank(alice);
        falseToken.approve(address(target), type(uint256).max);
        uint256 campaignId = _createOn(target, address(falseToken), 100 ether);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(falseToken)));
        target.pledge(campaignId, 100 ether, 0);
        assertEq(target.pledgedBy(campaignId, alice), 0);
    }

    function testCreatorClaimRollsBackWhenTransferFails() public {
        FailingTransferERC20 failingToken = new FailingTransferERC20();
        Crowdfunding target = _deployFor(address(failingToken));
        failingToken.mint(alice, GOAL);
        vm.prank(alice);
        failingToken.approve(address(target), GOAL);
        uint256 campaignId = _createOn(target, address(failingToken), GOAL);
        vm.prank(alice);
        target.pledge(campaignId, GOAL, 0);
        vm.warp(deadline);
        failingToken.setFailTransfers(true);

        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(failingToken)));
        target.claimFunds(campaignId);
        assertFalse(target.getCampaign(campaignId).fundsClaimed);
    }

    function testRefundAccountingRollsBackWhenTransferFails() public {
        FailingTransferERC20 failingToken = new FailingTransferERC20();
        Crowdfunding target = _deployFor(address(failingToken));
        failingToken.mint(alice, 100 ether);
        vm.prank(alice);
        failingToken.approve(address(target), 100 ether);
        uint256 campaignId = _createOn(target, address(failingToken), GOAL);
        vm.prank(alice);
        target.pledge(campaignId, 100 ether, 0);
        vm.warp(deadline);
        failingToken.setFailTransfers(true);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(failingToken)));
        target.claimRefund(campaignId);
        assertEq(target.pledgedBy(campaignId, alice), 100 ether);
        assertEq(target.getCampaign(campaignId).refunded, 0);
    }

    function testGoalAndPledgeUseSameRawTokenUnits() public {
        uint256 rawSixDecimalGoal = 1_000 * 1e6;
        uint256 campaignId = _createWith(address(token), rawSixDecimalGoal, deadline, _emptyTiers());
        _pledge(alice, campaignId, rawSixDecimalGoal, 0);
        vm.warp(deadline);
        assertEq(uint256(crowdfunding.status(campaignId)), uint256(Crowdfunding.CampaignStatus.Successful));
    }

    function testFeeOnTransferTokenPledgeRevertsWithoutAccountingChange() public {
        FeeERC20 feeToken = new FeeERC20();
        Crowdfunding target = _deployFor(address(feeToken));
        feeToken.mint(alice, 100 ether);
        vm.prank(alice);
        feeToken.approve(address(target), type(uint256).max);
        uint256 campaignId = _createOn(target, address(feeToken), 100 ether);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Crowdfunding.UnsupportedTokenBehavior.selector, address(feeToken)));
        target.pledge(campaignId, 100 ether, 0);
        assertEq(feeToken.balanceOf(alice), 100 ether);
        assertEq(target.pledgedBy(campaignId, alice), 0);
    }

    function testPledgeReentrancyIsBlocked() public {
        ReentrantERC20 reentrantToken = new ReentrantERC20();
        Crowdfunding target = _deployFor(address(reentrantToken));
        reentrantToken.mint(alice, 100 ether);
        vm.prank(alice);
        reentrantToken.approve(address(target), type(uint256).max);
        uint256 campaignId = _createOn(target, address(reentrantToken), 100 ether);
        reentrantToken.configure(address(target), abi.encodeCall(Crowdfunding.pledge, (campaignId, 1 ether, 0)));

        vm.prank(alice);
        target.pledge(campaignId, 100 ether, 0);
        assertTrue(reentrantToken.attempted());
        assertFalse(reentrantToken.callbackSucceeded());
        assertEq(target.pledgedBy(campaignId, alice), 100 ether);
    }

    function testFuzzPledgeAccounting(uint256 first, uint256 second) public {
        first = bound(first, 1, 4_000 ether);
        second = bound(second, 1, 4_000 ether);
        uint256 campaignId = _createDefault(_emptyTiers());
        _pledge(alice, campaignId, first, 0);
        _pledge(alice, campaignId, second, 0);
        assertEq(crowdfunding.pledgedBy(campaignId, alice), first + second);
        assertEq(crowdfunding.getCampaign(campaignId).pledged, first + second);
    }

    function testFuzzOutcomeMatchesGoal(uint256 goal, uint256 pledged) public {
        goal = bound(goal, 1, 5_000 ether);
        pledged = bound(pledged, 1, 10_000 ether);
        uint256 campaignId = _createWith(address(token), goal, deadline, _emptyTiers());
        _pledge(alice, campaignId, pledged, 0);
        vm.warp(deadline);
        Crowdfunding.CampaignStatus expected =
            pledged >= goal ? Crowdfunding.CampaignStatus.Successful : Crowdfunding.CampaignStatus.Failed;
        assertEq(uint256(crowdfunding.status(campaignId)), uint256(expected));
    }

    function _createDefault(Crowdfunding.RewardTierInput[] memory tiers) internal returns (uint256) {
        return _createWith(address(token), GOAL, deadline, tiers);
    }

    function _createWith(address tokenAddress, uint256 goal, uint256 end, Crowdfunding.RewardTierInput[] memory tiers)
        internal
        returns (uint256)
    {
        vm.prank(creator);
        return crowdfunding.createCampaign("Campaign", "Description", "", goal, tokenAddress, end, tiers);
    }

    function _createOn(Crowdfunding target, address tokenAddress, uint256 goal) internal returns (uint256) {
        vm.prank(creator);
        return target.createCampaign("Campaign", "Description", "", goal, tokenAddress, deadline, _emptyTiers());
    }

    function _deployFor(address tokenAddress) internal returns (Crowdfunding target) {
        address[] memory tokens = new address[](1);
        tokens[0] = tokenAddress;
        target = new Crowdfunding(tokens);
    }

    function _pledge(address supporter, uint256 campaignId, uint256 amount, uint256 tierId) internal {
        vm.prank(supporter);
        crowdfunding.pledge(campaignId, amount, tierId);
    }

    function _emptyTiers() internal pure returns (Crowdfunding.RewardTierInput[] memory) {
        return new Crowdfunding.RewardTierInput[](0);
    }

    function _tiers() internal pure returns (Crowdfunding.RewardTierInput[] memory tiers) {
        tiers = new Crowdfunding.RewardTierInput[](2);
        tiers[0] = Crowdfunding.RewardTierInput(10 ether, "Thank-you credit");
        tiers[1] = Crowdfunding.RewardTierInput(100 ether, "Launch supporter package");
    }
}
