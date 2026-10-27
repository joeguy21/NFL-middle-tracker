# Middle-First Opportunity Planner — Implementation Contract

Status: design contract for the feature branch. Not connected to live monitoring or production.

## Primary workflow
1. For an activated tracked game, ingest fresh, eligible spread quotes for both teams from supported books.
2. Apply eligibility filters before ranking: correct game/period/market, jurisdiction/availability where known, quote age, matching settlement rules, and team-specific original-book exclusion.
3. Enumerate opposing spread pairs. Calculate middle width using normalized team/margin conventions. Only pairs meeting the user's configured minimum width become middle candidates for the automatic middle-first path.
4. For each qualifying middle, find the strongest eligible odds for each required middle leg, allowing different sportsbooks. If a best quote changes the actual line, re-evaluate width and settlement outcomes; do not combine odds from a different line.
5. For each valid middle package, calculate stake combinations within configured exposure limits. Then search eligible opposing-team hedge quotes (which may come from another sportsbook) and stake amounts.
6. Evaluate the *whole coordinated plan* across all distinct settlement outcomes, including pushes/voids, rather than evaluating each leg in isolation.
7. Rank coordinated plans by user-configured objective and constraints. Return the best actionable plan with timestamps, book per leg, line, odds, stake, exposure, outcome net table, and assumptions.
8. Revalidate all quote IDs/prices before showing final acceptance. If the quote changed, recompute and require fresh user approval.

## Book eligibility
- Original team A sportsbook is excluded for new team A wagers only.
- Original team B sportsbook is excluded for new team B wagers only.
- Exclusions do not automatically apply to the opposing team.
- Different eligible books may be used for each middle leg and for the hedge.
- Never invent book support or account access. Distinguish feed support from the user's selected/preferred books and from local availability.
- The same quote must not be double-counted as multiple independently executable offers.

## Alert semantics
- Auto middle alert starts with the configured middle-width threshold.
- A qualifying width is a trigger, not proof of positive expected value or guaranteed profit.
- A hedge-only recommendation is a separate fallback/update feature and must not be represented as a qualifying middle.
- Manual Calculation may inspect all widths as specified in product behavior, but must label plans clearly.
- Declining a plan suppresses unchanged repeats until a material quote, line, or plan improvement occurs.

## Modeling requirements / safety
- Spread sign convention and margin orientation must be explicit and tested.
- Settlement engine must represent pushes, half-point lines, integer lines, overtime/period rules, ties where applicable, and book-specific settlement differences.
- Evaluate each leg's actual win/loss/push settlement against the same game outcome. A spread middle is not automatically profitable.
- Display net results after accounting for original wagers and proposed new legs, with original stake/odds stored per side.
- Enforce max additional stake and max total game exposure, and clearly show any plan that cannot satisfy desired targets.
- Partial execution risk: if a user places only some legs or odds move, show the unhedged state; no claim that the system placed bets.
- Use quote timestamps/freshness and stop actionability for stale/incomplete data.
- The current integer-margin +/-60 single-hedge prototype is not sufficient for production use.

## Ranking
1. Filter out invalid/stale/ineligible packages.
2. Prefer plans meeting explicitly configured guaranteed-outcome floor, if achievable.
3. Among eligible plans, rank using the configured objective (e.g., maximize worst-case net), with clear tie-breakers.
4. Report middle-hit outcome and all non-middle outcomes separately; do not rank solely by width or best displayed price.

## Verification gates
- Unit tests for odds conversion, spread settlement, pushes, half points, margin orientation, team-specific book exclusions, line/quote matching, multi-book combinations, exposure constraints, and coordinated plan ranking.
- Scenario tests for: middle hit; middle miss each direction; push on either/both legs; stale quotes; excluded original book on one side but permitted on other; and quote changing between calculation and acceptance.
- Run tests before connecting planner to live odds or deploying.
