# Falcon team amplification pack

## Campaign line

Same signature. Less gas to verify.

## Graphics

All four cards are 1920 by 1080 pixels, exactly 16:9. Use the PNGs for posting and edit the matching SVGs when the record or wording changes. The official Falcon rider and falcon artwork is embedded in each SVG, so every source stays portable as a single file.

| Asset | Role | Alt text |
| --- | --- | --- |
| `falcon-quote-card.png` | Main announcement. Same signature, 42.3% less gas. | A sunglass-wearing rider on a blue and white falcon flies above a descending cost line. Falcon-512 verification is shown at 27.9 million gas, down 42.3% from the 48.4 million gas OpenZeppelin baseline. |
| `track-optimize.png` | Scored optimization track. Beat 27.9M gas by at least 0.1% and pass correctness checks. | The Falcon rider flies along a descending curve beside the current 27.9 million gas record. A new patch must beat the record by at least 0.1% and pass every correctness check. |
| `track-attack.png` | Safety and counterexample track. | A schematic compares reference and record checks for two matching inputs and one illustrative mismatch. The caption says no known break is claimed. |
| `track-keccak.png` | Open research track. Explore Keccak work in Falcon-512. | The Falcon rider flies through a 5 by 5 Keccak state illustration. The card invites research into native support, arithmetic approaches, and Stwo. |

## Videos

All four are 1080p, 60fps, with sound, in `videos/`. Each film comes in 16:9 (1920 by 1080) and 4:3 (1440 by 1080).

| Asset | Length | Role | Alt text |
| --- | --- | --- | --- |
| `falcon-flight-16x9.mp4`, `falcon-flight-4x3.mp4` | 20s | The funny one. The falcon and dog haul a 48.4M gas sack, throw inefficiencies overboard, land at 27.9M and spend the savings on tacos. | The Falcon rider hauls a sack labelled 48.4M gas while the dog throws crates overboard. The counter falls to 27.9M gas, 42.3% less, and the pair end up at the taco stand. End card: Your turn. Make it lighter. falcon.provably.fast. |
| `falcon-counter-16x9.mp4`, `falcon-counter-4x3.mp4` | 13s | The number. Counts down through all 22 records from 48,398,466 to 27,915,721 gas, then 27.9M, then 42.3% less. | A counter rolls down from the 48,398,466 gas OpenZeppelin baseline through 22 records to the 27,915,721 gas current record, collapses to 27.9M gas to verify Falcon-512, then shows 42.3% less gas, same signature, and the falcon.provably.fast logo. |

The overboard crate labels in the flight film (slow Keccak rotations, unpacked Keccak lanes, recomputed constants, one division) are playful groupings of the record history. The amounts they remove add up exactly to the real drop.

## Ready-to-post copy

### Launch

We want quantum-safe signatures to cost less to verify. Falcon-512 is at 27.9M gas, down 42.3% from the 48.4M OpenZeppelin baseline. The challenge is open. Bring an optimization, a counterexample, or a Keccak idea: https://falcon.provably.fast/

### For builders

The current Falcon-512 verification record is 27.9M gas against a 48.4M OpenZeppelin baseline. We are looking for Cairo optimizations, counterexamples, and Keccak research. Every scored patch must pass the same correctness checks: https://falcon.provably.fast/

### Invite a quote tweet

What would you try first: make verification cheaper, find a counterexample, or take on Keccak? The Falcon-512 challenge is open: https://falcon.provably.fast/

### Short version

Same Falcon-512 signature. 42.3% less gas to verify against the OpenZeppelin baseline. Help push the record lower: https://falcon.provably.fast/

### Optimization track

The current Falcon-512 verifier record is 27.9M gas. To beat it, a patch needs to be at least 0.1% cheaper and pass the same correctness checks. What would you try? https://falcon.provably.fast/record

### Attack track

Optimization only matters if it stays correct. We are looking for a reproducible input that makes a Falcon-512 record disagree with the reference. Break it and help strengthen the test suite: https://falcon.provably.fast/safe

### Keccak research

Keccak is a major cost in Falcon-512 verification. Explore native support, arithmetic approaches, or Stwo. Share findings as you go, even before they are ready for a score: https://falcon.provably.fast/threads

## Suggested rollout

Lead with the main announcement card. Follow with the optimization, attack, and Keccak cards as separate posts, each with the matching copy above. This gives people three concrete ways to join the challenge without repeating the same announcement.

## Team guidance

Add a personal sentence about why the challenge interests you. Link to the live record when discussing the number. Do not imply that you submitted or reviewed a patch unless you did. Recheck the live figures before scheduling posts, since the record can change.

## Claim source

Values were checked against the live Falcon results endpoint on 20 October 2026. It reported a 48,398,466 gas OpenZeppelin baseline and a 27,915,721 gas current record. The reduction is 42.321%, rounded to 42.3%. The graphic rounds the gas values to one decimal place in millions.

Live record: https://falcon.provably.fast/record

Challenge: https://falcon.provably.fast/
