import { parseAbi } from "viem";

// Generated from packages/contracts/src/Crowdfunding.sol with `forge inspect Crowdfunding abi`.
export const crowdfundingAbi = parseAbi([
  "function campaignCount() view returns (uint256)",
  "function createCampaign(string title,string description,string imageURI,uint256 goal,address token,uint256 deadline,(uint256 minimumContribution,string perk)[] tiers) returns (uint256 campaignId)",
  "function getCampaign(uint256 campaignId) view returns ((address creator,address token,uint256 goal,uint256 deadline,uint256 pledged,uint256 refunded,bool fundsClaimed,string title,string description,string imageURI))",
  "function getRewardTiers(uint256 campaignId) view returns ((uint256 minimumContribution,string perk)[])",
  "function pledgedBy(uint256 campaignId,address supporter) view returns (uint256 amount)",
  "function pledge(uint256 campaignId,uint256 amount,uint256 tierId)",
  "function claimFunds(uint256 campaignId)",
  "function claimRefund(uint256 campaignId)",
  "function status(uint256 campaignId) view returns (uint8)",
  "function isTokenAllowed(address token) view returns (bool)",
  "event CampaignCreated(uint256 indexed campaignId,address indexed creator,address indexed token,uint256 goal,uint256 deadline,string title,string description,string imageURI)",
  "event RewardTierCreated(uint256 indexed campaignId,uint256 indexed tierId,uint256 minimumContribution,string perk)",
  "event Pledged(uint256 indexed campaignId,address indexed supporter,uint256 amount,uint256 indexed tierId)",
  "event FundsClaimed(uint256 indexed campaignId,address indexed creator,uint256 amount)",
  "event Refunded(uint256 indexed campaignId,address indexed supporter,uint256 amount)",
]);

export const erc20Abi = parseAbi([
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);
