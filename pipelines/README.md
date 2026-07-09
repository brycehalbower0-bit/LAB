# /pipelines — Data acquisition & ingestion (Python)

The fetch → normalize → reconcile → validate → stage → propose pipeline framework
(docs/04-data-acquisition-and-provenance.md §3). Framework arrives in Phase 15
(Natural Earth); every source gets a pipeline + runbook + golden-file tests.

Python 3.11+, managed with uv; mirrors of the `historical-date` and identifier
specs are tested against the shared golden vectors (ADR-001).
