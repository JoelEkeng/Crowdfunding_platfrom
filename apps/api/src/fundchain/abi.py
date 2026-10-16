from typing import Any

CROWDFUNDING_EVENTS_ABI: list[dict[str, Any]] = [
    {
        "anonymous": False,
        "type": "event",
        "name": "CampaignCreated",
        "inputs": [
            {"indexed": True, "name": "campaignId", "type": "uint256"},
            {"indexed": True, "name": "creator", "type": "address"},
            {"indexed": True, "name": "token", "type": "address"},
            {"indexed": False, "name": "goal", "type": "uint256"},
            {"indexed": False, "name": "deadline", "type": "uint256"},
            {"indexed": False, "name": "title", "type": "string"},
            {"indexed": False, "name": "description", "type": "string"},
            {"indexed": False, "name": "imageURI", "type": "string"},
        ],
    },
    {
        "anonymous": False,
        "type": "event",
        "name": "RewardTierCreated",
        "inputs": [
            {"indexed": True, "name": "campaignId", "type": "uint256"},
            {"indexed": True, "name": "tierId", "type": "uint256"},
            {"indexed": False, "name": "minimumContribution", "type": "uint256"},
            {"indexed": False, "name": "perk", "type": "string"},
        ],
    },
    {
        "anonymous": False,
        "type": "event",
        "name": "Pledged",
        "inputs": [
            {"indexed": True, "name": "campaignId", "type": "uint256"},
            {"indexed": True, "name": "supporter", "type": "address"},
            {"indexed": False, "name": "amount", "type": "uint256"},
            {"indexed": True, "name": "tierId", "type": "uint256"},
        ],
    },
    {
        "anonymous": False,
        "type": "event",
        "name": "FundsClaimed",
        "inputs": [
            {"indexed": True, "name": "campaignId", "type": "uint256"},
            {"indexed": True, "name": "creator", "type": "address"},
            {"indexed": False, "name": "amount", "type": "uint256"},
        ],
    },
    {
        "anonymous": False,
        "type": "event",
        "name": "Refunded",
        "inputs": [
            {"indexed": True, "name": "campaignId", "type": "uint256"},
            {"indexed": True, "name": "supporter", "type": "address"},
            {"indexed": False, "name": "amount", "type": "uint256"},
        ],
    },
]

EVENT_NAMES = tuple(item["name"] for item in CROWDFUNDING_EVENTS_ABI)
