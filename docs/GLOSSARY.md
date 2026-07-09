# Glossary

Binding vocabulary. Code identifiers, schema names, and docs use these terms with
exactly these meanings.

| Term | Meaning |
|---|---|
| **Assertion** | One dated, sourced, confidence-scored claim about a subject entity (doc 03 §4). The atomic unit of knowledge. |
| **Canon / canonical plane** | The set of live primary assertions in the system of record. The only source of truth. |
| **Serving plane** | Derived, disposable read models: snapshots, tiles, search indexes, quiz banks. Always rebuildable from canon. |
| **Entity** | A knowable thing with a registry row and stable public ID: place, polity, person, event, treaty, language, religion, currency, work, idea, source. |
| **Polity** | Any political unit through history: state, empire, kingdom, colony, city-state, tribe-confederation, vassal. |
| **Place** | A geographic entity independent of politics (the city of Paris as a place, distinct from any polity that owned it). |
| **HistoricalDate** | The project-wide time value: ordinal (Julian Day–based int64) + precision + optional earliest/latest bounds + calendar of record (ADR-015). |
| **Precision** | The honesty level of a HistoricalDate: day, month, season, year, decade, century, millennium, era. |
| **Valid time** | The historical interval during which an assertion was true in the world. |
| **Record time** | When the database asserted it (revision watermarks) — enables "what did Chronos say last March?". |
| **Bitemporal** | Tracking both valid time and record time. |
| **Interpretation** | Assertion stance: `accepted`, `disputed`, `traditional`, `conjectural`, `superseded`. |
| **Primacy** | Flag marking the editorially-selected primary assertion among coexisting alternatives. |
| **Certainty class** | Border geometry honesty: surveyed, treaty_defined, approximate, frontier_zone, disputed, conjectural. |
| **Geometry version** | An immutable stored geometry with provenance; border claims reference versions and add validity + certainty. |
| **World Snapshot** | The composed answer to "what was the world at time T": polities, leaders, wars, events, culture — the central read model (doc 03 §7). |
| **Time bucket** | The cacheable quantization of time per layer/era resolution (e.g., `y1848`, `d1840`, `c-0500`). |
| **Revision** | An immutable, attributed, reversible unit of change to canon; created only through the curation pipeline. |
| **Proposal** | A proposed revision awaiting the AI gate and human review. |
| **AI validation gate** | Automatic pre-review analysis of every proposal: mechanical checks, source verification, consistency, duplicates, spam scoring, review brief (ADR-017). Never approves. |
| **Review brief** | The AI gate's structured summary attached to a proposal for human reviewers. |
| **Reputation tier** | Contributor trust level: new → established → trusted → reviewer. |
| **Protection level** | Per-topic review strictness: open → elevated → protected. |
| **Source** | An entity representing a dataset, book, article, map, or archive; carries reliability class A–D and license record. |
| **Citation** | A link from an assertion to a source (+locator, +supports/disputes). |
| **Importance score** | Computed + editorially adjustable prominence of an entity/event; drives labels, snapshot inclusion, search rank, quiz frequency. |
| **Instrument** | The coupled map + timeline + context panel home experience (doc 06 §1). |
| **Layer** | A combinable thematic map dimension (political, religion, trade, …) with declared period-resolution support. |
| **Item (quiz item)** | A generated question bound to the assertions it derives from. |
| **Study pack** | Offline bundle (tiles + snapshots + items) for a region×era, primarily for iOS. |
| **Tour / story map** | Curated narrative sequence of (T, viewport, layers, entities, text) stops. |
| **Epoch (roadmap)** | A group of ~12–13 roadmap phases with a shared theme. Distinct from historical *era*. |
| **Phase** | The unit of implementation: objectives → acceptance → done, one at a time (charter rule). |
| **Region-period cell** | A (geographic region × historical period) unit used for coverage metrics and prioritization. |
| **Golden vectors** | Shared cross-language test fixtures (TS/Python/Swift) for the historical-date spec and other shared specs. |
| **Known worlds** | Locked regression fixtures of full snapshot/tile/page output for reference moments (e.g., Mediterranean 117 CE). |
