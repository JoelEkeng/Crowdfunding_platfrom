// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Crowdfunding is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum CampaignStatus {
        Active,
        Successful,
        Failed
    }

    struct Campaign {
        address creator;
        IERC20 token;
        uint256 goal;
        uint256 deadline;
        uint256 pledged;
        uint256 refunded;
        bool fundsClaimed;
        string title;
        string description;
        string imageURI;
    }

    struct RewardTier {
        uint256 minimumContribution;
        string perk;
    }

    struct RewardTierInput {
        uint256 minimumContribution;
        string perk;
    }

    error EmptyTokenPolicy();
    error InvalidToken(address token);
    error DuplicateToken(address token);
    error EmptyTitle();
    error InvalidGoal();
    error InvalidDeadline(uint256 deadline, uint256 currentTimestamp);
    error InvalidCampaignDuration(uint256 duration, uint256 minimum, uint256 maximum);
    error MetadataTooLong(uint256 supplied, uint256 maximum);
    error TooManyTiers(uint256 supplied, uint256 maximum);
    error InvalidTier(uint256 tierIndex);
    error CampaignNotFound(uint256 campaignId);
    error CampaignEnded(uint256 campaignId);
    error CampaignStillActive(uint256 campaignId);
    error InvalidAmount();
    error InvalidTierSelection(uint256 tierId);
    error TierMinimumNotMet(uint256 tierId, uint256 minimum, uint256 amount);
    error UnsupportedTokenBehavior(address token);
    error Unauthorized(address caller);
    error CampaignFailed(uint256 campaignId);
    error CampaignSucceeded(uint256 campaignId);
    error FundsAlreadyClaimed(uint256 campaignId);
    error NoRefundAvailable(uint256 campaignId, address supporter);

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed creator,
        address indexed token,
        uint256 goal,
        uint256 deadline,
        string title,
        string description,
        string imageURI
    );
    event RewardTierCreated(
        uint256 indexed campaignId, uint256 indexed tierId, uint256 minimumContribution, string perk
    );
    event Pledged(uint256 indexed campaignId, address indexed supporter, uint256 amount, uint256 indexed tierId);
    event FundsClaimed(uint256 indexed campaignId, address indexed creator, uint256 amount);
    event Refunded(uint256 indexed campaignId, address indexed supporter, uint256 amount);

    uint256 public constant MIN_CAMPAIGN_DURATION = 1 hours;
    uint256 public constant MAX_CAMPAIGN_DURATION = 365 days;
    uint256 public constant MAX_REWARD_TIERS = 20;
    uint256 public constant MAX_TITLE_LENGTH = 100;
    uint256 public constant MAX_DESCRIPTION_LENGTH = 2_000;
    uint256 public constant MAX_IMAGE_URI_LENGTH = 500;
    uint256 public constant MAX_PERK_LENGTH = 500;

    uint256 public campaignCount;
    mapping(address token => bool allowed) public isTokenAllowed;
    mapping(uint256 campaignId => Campaign campaign) private _campaigns;
    mapping(uint256 campaignId => RewardTier[] tiers) private _rewardTiers;
    mapping(uint256 campaignId => mapping(address supporter => uint256 amount)) public pledgedBy;

    constructor(address[] memory trustedTokens) {
        if (trustedTokens.length == 0) revert EmptyTokenPolicy();
        for (uint256 i = 0; i < trustedTokens.length; ++i) {
            address token = trustedTokens[i];
            if (token == address(0) || token.code.length == 0) revert InvalidToken(token);
            if (isTokenAllowed[token]) revert DuplicateToken(token);
            isTokenAllowed[token] = true;
        }
    }

    function createCampaign(
        string calldata title,
        string calldata description,
        string calldata imageURI,
        uint256 goal,
        address token,
        uint256 deadline,
        RewardTierInput[] calldata tiers
    ) external returns (uint256 campaignId) {
        if (bytes(title).length == 0) revert EmptyTitle();
        if (bytes(title).length > MAX_TITLE_LENGTH) revert MetadataTooLong(bytes(title).length, MAX_TITLE_LENGTH);
        if (bytes(description).length > MAX_DESCRIPTION_LENGTH) {
            revert MetadataTooLong(bytes(description).length, MAX_DESCRIPTION_LENGTH);
        }
        if (bytes(imageURI).length > MAX_IMAGE_URI_LENGTH) {
            revert MetadataTooLong(bytes(imageURI).length, MAX_IMAGE_URI_LENGTH);
        }
        if (goal == 0) revert InvalidGoal();
        if (!isTokenAllowed[token]) revert InvalidToken(token);
        if (deadline <= block.timestamp) revert InvalidDeadline(deadline, block.timestamp);
        uint256 duration = deadline - block.timestamp;
        if (duration < MIN_CAMPAIGN_DURATION || duration > MAX_CAMPAIGN_DURATION) {
            revert InvalidCampaignDuration(duration, MIN_CAMPAIGN_DURATION, MAX_CAMPAIGN_DURATION);
        }
        if (tiers.length > MAX_REWARD_TIERS) revert TooManyTiers(tiers.length, MAX_REWARD_TIERS);

        campaignId = ++campaignCount;
        Campaign storage campaign = _campaigns[campaignId];
        campaign.creator = msg.sender;
        campaign.token = IERC20(token);
        campaign.goal = goal;
        campaign.deadline = deadline;
        campaign.title = title;
        campaign.description = description;
        campaign.imageURI = imageURI;

        uint256 previousMinimum = 0;
        for (uint256 i = 0; i < tiers.length; ++i) {
            RewardTierInput calldata tier = tiers[i];
            if (
                tier.minimumContribution == 0 || bytes(tier.perk).length == 0
                    || bytes(tier.perk).length > MAX_PERK_LENGTH || tier.minimumContribution <= previousMinimum
            ) {
                revert InvalidTier(i);
            }
            previousMinimum = tier.minimumContribution;
            _rewardTiers[campaignId].push(RewardTier(tier.minimumContribution, tier.perk));
            emit RewardTierCreated(campaignId, i + 1, tier.minimumContribution, tier.perk);
        }

        emit CampaignCreated(campaignId, msg.sender, token, goal, deadline, title, description, imageURI);
    }

    function pledge(uint256 campaignId, uint256 amount, uint256 tierId) external nonReentrant {
        Campaign storage campaign = _getCampaign(campaignId);
        if (block.timestamp >= campaign.deadline) revert CampaignEnded(campaignId);
        if (amount == 0) revert InvalidAmount();
        if (tierId > _rewardTiers[campaignId].length) revert InvalidTierSelection(tierId);
        if (tierId != 0) {
            uint256 minimum = _rewardTiers[campaignId][tierId - 1].minimumContribution;
            if (amount < minimum) revert TierMinimumNotMet(tierId, minimum, amount);
        }

        uint256 balanceBefore = campaign.token.balanceOf(address(this));
        campaign.token.safeTransferFrom(msg.sender, address(this), amount);
        if (campaign.token.balanceOf(address(this)) - balanceBefore != amount) {
            revert UnsupportedTokenBehavior(address(campaign.token));
        }

        campaign.pledged += amount;
        pledgedBy[campaignId][msg.sender] += amount;
        emit Pledged(campaignId, msg.sender, amount, tierId);
    }

    function claimFunds(uint256 campaignId) external nonReentrant {
        Campaign storage campaign = _getCampaign(campaignId);
        if (msg.sender != campaign.creator) revert Unauthorized(msg.sender);
        if (block.timestamp < campaign.deadline) revert CampaignStillActive(campaignId);
        if (campaign.pledged < campaign.goal) revert CampaignFailed(campaignId);
        if (campaign.fundsClaimed) revert FundsAlreadyClaimed(campaignId);

        campaign.fundsClaimed = true;
        uint256 amount = campaign.pledged;
        campaign.token.safeTransfer(campaign.creator, amount);
        emit FundsClaimed(campaignId, campaign.creator, amount);
    }

    function claimRefund(uint256 campaignId) external nonReentrant {
        Campaign storage campaign = _getCampaign(campaignId);
        if (block.timestamp < campaign.deadline) revert CampaignStillActive(campaignId);
        if (campaign.pledged >= campaign.goal) revert CampaignSucceeded(campaignId);

        uint256 amount = pledgedBy[campaignId][msg.sender];
        if (amount == 0) revert NoRefundAvailable(campaignId, msg.sender);
        pledgedBy[campaignId][msg.sender] = 0;
        campaign.refunded += amount;
        campaign.token.safeTransfer(msg.sender, amount);
        emit Refunded(campaignId, msg.sender, amount);
    }

    function getCampaign(uint256 campaignId) external view returns (Campaign memory) {
        return _getCampaign(campaignId);
    }

    function getRewardTiers(uint256 campaignId) external view returns (RewardTier[] memory) {
        _getCampaign(campaignId);
        return _rewardTiers[campaignId];
    }

    function status(uint256 campaignId) public view returns (CampaignStatus) {
        Campaign storage campaign = _getCampaign(campaignId);
        if (block.timestamp < campaign.deadline) return CampaignStatus.Active;
        return campaign.pledged >= campaign.goal ? CampaignStatus.Successful : CampaignStatus.Failed;
    }

    function _getCampaign(uint256 campaignId) private view returns (Campaign storage campaign) {
        campaign = _campaigns[campaignId];
        if (campaign.creator == address(0)) revert CampaignNotFound(campaignId);
    }
}
