from pathlib import Path

EVENTS = {
    "CampaignCreated": (
        "CampaignCreated(uint256,address,address,uint256,uint256,string,string,string)"
    ),
    "RewardTierCreated": "RewardTierCreated(uint256,uint256,uint256,string)",
    "Pledged": "Pledged(uint256,address,uint256,uint256)",
    "FundsClaimed": "FundsClaimed(uint256,address,uint256)",
    "Refunded": "Refunded(uint256,address,uint256)",
}


def test_frontend_backend_and_contract_name_same_events() -> None:
    root = Path(__file__).resolve().parents[4]
    solidity = (root / "packages/contracts/src/Crowdfunding.sol").read_text()
    frontend = (root / "apps/web/lib/abi/crowdfunding.ts").read_text()
    backend = (root / "apps/api/src/fundchain/abi.py").read_text()
    for event_name in EVENTS:
        assert f"event {event_name}" in solidity
        assert f"event {event_name}(" in frontend
        assert f'"name": "{event_name}"' in backend
