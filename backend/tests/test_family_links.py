"""Isolated unit coverage for cross-constituency family links."""
import asyncio
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import family_links


def _matches(document, query):
    for key, expected in query.items():
        if key == "$or":
            if not any(_matches(document, branch) for branch in expected):
                return False
            continue
        actual = document.get(key)
        if isinstance(expected, dict):
            if "$in" in expected and actual not in expected["$in"]:
                return False
            if "$ne" in expected and actual == expected["$ne"]:
                return False
        elif actual != expected:
            return False
    return True


class _Cursor:
    def __init__(self, rows):
        self.rows = rows

    async def to_list(self, length):
        return self.rows[:length]

    def __aiter__(self):
        self._iterator = iter(self.rows)
        return self

    async def __anext__(self):
        try:
            return next(self._iterator)
        except StopIteration:
            raise StopAsyncIteration


class _Collection:
    def __init__(self, documents=()):
        self.documents = [dict(document) for document in documents]

    def find(self, query, projection=None):
        return _Cursor([row for row in self.documents if _matches(row, query)])

    async def find_one(self, query, projection=None):
        return next((row for row in self.documents if _matches(row, query)), None)

    async def insert_one(self, document):
        self.documents.append(dict(document))

    async def update_one(self, query, update):
        for row in self.documents:
            if _matches(row, query):
                row.update(update.get("$set", {}))
                return type("Result", (), {"matched_count": 1})()
        return type("Result", (), {"matched_count": 0})()

    async def update_many(self, query, update):
        matched = 0
        for row in self.documents:
            if _matches(row, query):
                row.update(update.get("$set", {}))
                matched += 1
        return type("Result", (), {"matched_count": matched})()

    async def delete_one(self, query):
        for index, row in enumerate(self.documents):
            if _matches(row, query):
                del self.documents[index]
                return type("Result", (), {"deleted_count": 1})()
        return type("Result", (), {"deleted_count": 0})()


class _Database:
    def __init__(self):
        self.users = _Collection([
            {
                "id": "user-a", "person_id": "person-a", "name": "Asha",
                "mobile": "9000000001", "tenant_id": "JS1000",
                "role": "citizen", "is_active": True, "gender": "female",
                "household_id": "house-a",
            },
            {
                "id": "user-b", "person_id": "person-b", "name": "Ravi",
                "mobile": "9000000002", "tenant_id": "JS2000",
                "role": "citizen", "is_active": True, "gender": "male",
                "household_id": "house-b",
            },
        ])
        self.persons = _Collection([
            {"id": "person-a", "current_organisation_id": "JS1000", "name": "Asha"},
            {"id": "person-b", "current_organisation_id": "JS2000", "name": "Ravi"},
        ])
        self._v2_user_to_person = _Collection([
            {"_id": "user-a", "person_id": "person-a"},
            {"_id": "user-b", "person_id": "person-b"},
        ])
        self.relationships_v2 = _Collection()
        self.relationships = _Collection()
        self.family_invitations = _Collection([
            {
                "id": "invite-1",
                "tenant_id": "JS1000",
                "from_user_id": "user-a",
                "from_person_id": "person-a",
                "target_mobile": "9000000002",
                "target_name": "Ravi",
                "relation_type": "Father",
                "status": "pending",
            },
        ])
        self.portal_configs = _Collection([
            {"id": "JS1000", "constituency_name": "North Constituency"},
            {"id": "JS2000", "constituency_name": "South Constituency"},
        ])

    def __getitem__(self, name):
        return getattr(self, name)


def test_cross_constituency_invite_links_profiles_without_moving_records():
    async def scenario():
        db = _Database()
        sender_before = dict(db.users.documents[0])
        recipient_before = dict(db.users.documents[1])

        accepted = await family_links.accept_family_invitation(
            db,
            "invite-1",
            {
                "id": "user-b",
                "person_id": "person-b",
                "mobile": "9000000002",
                "tenant_id": "JS2000",
                "role": "citizen",
                "gender": "male",
            },
        )

        assert accepted["cross_constituency"] is True
        assert db.family_invitations.documents[0]["status"] == "linked"
        assert db.relationships.documents == []
        assert db.users.documents == [sender_before, recipient_before]

        sender_links = await family_links.list_family_members(db, db.users.documents[0])
        recipient_links = await family_links.list_family_members(db, db.users.documents[1])
        assert len(sender_links) == len(recipient_links) == 1
        assert sender_links[0]["other_name"] == "Ravi"
        assert sender_links[0]["other_constituency"] == "South Constituency"
        assert sender_links[0]["cross_constituency"] is True
        assert "other_person_id" not in sender_links[0]
        assert "other_user_id" not in sender_links[0]
        assert recipient_links[0]["other_name"] == "Asha"
        assert recipient_links[0]["other_constituency"] == "North Constituency"
        assert recipient_links[0]["cross_constituency"] is True
        for link in sender_links + recipient_links:
            assert not {"household_id", "issues", "service_history"} & set(link)

        removed = await family_links.remove_family_relationship(
            db, accepted["relationship_id"], db.users.documents[0]
        )
        assert removed is True
        assert await family_links.list_family_members(db, db.users.documents[0]) == []
        assert await family_links.list_family_members(db, db.users.documents[1]) == []
        assert db.users.documents == [sender_before, recipient_before]

    asyncio.run(scenario())
