import json
from unittest.mock import patch

from backend import push_service


class FakeExpoResponse:
    def __init__(self, tickets):
        self.tickets = tickets

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps({"data": self.tickets}).encode()


def test_expo_push_includes_issue_link_and_prunes_unregistered_token(monkeypatch):
    tokens = ["ExpoPushToken[good]", "ExponentPushToken[unregistered]"]
    response = FakeExpoResponse([
        {"status": "ok"},
        {"status": "error", "details": {"error": "DeviceNotRegistered"}},
    ])
    monkeypatch.setattr(push_service, "_adapter", push_service._NoopAdapter())

    with patch.object(push_service.urllib.request, "urlopen", return_value=response) as send:
        result = push_service.send(
            tokens,
            "Your issue has been resolved",
            "Open the app to review the result.",
            data={"issue_id": "issue-123"},
            click_action="/app/issues/issue-123",
        )

    payload = json.loads(send.call_args.args[0].data)
    assert payload[0]["data"] == {
        "issue_id": "issue-123",
        "click_action": "/app/issues/issue-123",
    }
    assert result == {
        "success": 1,
        "failure": 1,
        "invalid_tokens": ["ExponentPushToken[unregistered]"],
    }


def test_expo_push_splits_large_batches(monkeypatch):
    tokens = [f"ExpoPushToken[{index}]" for index in range(101)]
    responses = [
        FakeExpoResponse([{"status": "ok"}] * 100),
        FakeExpoResponse([{"status": "ok"}]),
    ]
    monkeypatch.setattr(push_service, "_adapter", push_service._NoopAdapter())

    with patch.object(push_service.urllib.request, "urlopen", side_effect=responses) as send:
        result = push_service.send(tokens, "Update", "Progress changed.")

    assert send.call_count == 2
    assert [len(json.loads(call.args[0].data)) for call in send.call_args_list] == [100, 1]
    assert result == {"success": 101, "failure": 0, "invalid_tokens": []}
