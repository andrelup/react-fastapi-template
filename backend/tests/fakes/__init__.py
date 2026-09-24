"""Fakes shared by two or more test modules.

Promoted here from a test file the moment a second consumer needs the same
fake — see `docs/backend-testing.md` §3. `FakeCollectionRepository` is the
first tenant: both `tests/unit/test_collection_service.py` and
`tests/unit/test_item_service.py` need it, the latter because `ItemService`
takes a `CollectionRepository` for `set_collections`.
"""
