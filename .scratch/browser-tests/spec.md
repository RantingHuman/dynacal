# Spec: Reliable component and browser tests

Status: ready-for-agent

## Problem Statement

The owner wants confidence that dynacal's main journeys work after changes. Component tests now cover some Task, phone and Settings interactions, but important editor and review interactions remain uncovered, and two rollback tests have shown timing-dependent failures. Component tests also cannot establish that the built app, authentication, browser layout, persistence and service worker work together. Google sign-in and the owner's real data cannot safely be dependencies of a repeatable browser suite.

## Solution

Stabilize the existing component tests and continue filling their most valuable gaps. Add a small, independently runnable Playwright suite against an isolated, production-like local app with deterministic data and time, fake external services and a seeded ordinary owner session. Verify that its test setup cannot be enabled in the deployed production app. Use manual checks for real Google and real-device behavior that the suite does not establish.

## User Stories

1. As the owner, I want the existing component tests to pass reliably under load, so that a test failure is useful evidence of a regression.
2. As the owner, I want a refused Task addition to restore the input and remove the optimistic Task, so that a failed change is clear.
3. As the owner, I want a refused Task completion to restore the Task's control, so that it is not left appearing complete.
4. As the owner, I want to test saving and cancelling changes in the full-page Task editor, so that editing remains dependable.
5. As the owner, I want the editor's Delete and Keep choices tested, so that I can avoid accidental deletion.
6. As the owner, I want clearing a Declined Time tested, so that I can change where a Task may be scheduled.
7. As the owner, I want the Task editor's offline controls tested, so that it does not offer changes it cannot save.
8. As the owner, I want desktop Block Save, Unpin and Mark done tested, so that the floating label remains usable.
9. As the owner, I want Busy Override and Escape in the desktop floating label tested, so that Event controls and dismissal remain usable.
10. As the owner, I want Done, Partly and Not done reviews tested, so that past work is recorded correctly.
11. As the owner, I want the review pager, completion state and offline behavior tested, so that review remains understandable and safe.
12. As the owner, I want grouped Working Hours edits and splitting a day out tested, so that the intended days receive changes.
13. As the owner, I want overlapping Working Hours held unsaved, so that invalid settings are not sent.
14. As the owner, I want setup progression and invalid input tested, so that I can complete setup in order.
15. As the owner, I want Task-line preview chips and headline links tested, so that their visible interactions remain correct.
16. As the owner, I want a browser test to add and complete a Task and confirm the result after reload, so that the whole flow and persistence are exercised.
17. As the owner, I want browser tests to move a Block on desktop and at phone width, so that both interaction paths work together with the app.
18. As the owner, I want a browser test to change Settings and confirm them after reload, so that saving works through the full app.
19. As the owner, I want a previously loaded home page readable offline, so that I can still see my week when the connection drops.
20. As the owner, I want offline mutation controls disabled and an uncached page to show the offline fallback, so that the offline experience is honest.
21. As the owner, I want browser tests to use separate disposable data, so that they never change my live deployment.
22. As the owner, I want fake calendar and push services during browser tests, so that the suite does not access my Google account or send real notifications.
23. As the owner, I want browser tests to use a seeded normal session, so that normal session checks remain exercised without Google sign-in.
24. As the owner, I want the deployed app unable to enable test session setup, so that browser testing cannot become a sign-in bypass.
25. As the owner, I want that production boundary checked automatically, so that future changes do not quietly weaken it.
26. As the owner, I want independent fixtures and controlled time, so that tests can run alone and give repeatable results.
27. As the owner, I want a separate browser-test command, so that I can use fast checks during development and run browser checks before merges and releases.
28. As the owner, I want the suite's limits documented, so that passing it is not mistaken for checking real Google or real phones.

## Implementation Decisions

- Continue the component-test work on its existing branch; stabilize the rollback assertions before proposing a merge. The merge remains the owner's decision.
- Use existing accessible component interfaces and guarded rendering for component coverage. Server actions are substituted at the existing test boundary. Cover the listed interactions in small slices, including relevant refusal and offline states.
- The first end-to-end suite uses Chromium with desktop and phone-sized viewports, against a production-like local build. It is a separate command to run before merges or releases.
- Each browser test has an independent app process, browser context, disposable database, known fixture, fake calendar and fake push sender. It must not use live credentials, data or services; it binds only to loopback and fails closed when isolation cannot be established.
- Seed a normal owner session into the isolated database and supply its cookie to the browser. Keep normal authentication checks active and expose no general-purpose session creation or authentication bypass endpoint.
- The deployed production artifact must not include or enable the test setup, even through runtime configuration. Verify this boundary automatically against the actual deployable artifact and a disposable database; never use live data for the check.
- Use a known time consistently across server-side behavior, session expiry and browser-facing date calculations; audit direct clock reads rather than assuming the existing fake clock covers them. Set an explicit time zone.
- The browser-test design proposes building from an isolated source copy with a test-only runtime substituted in that copy, excluding the harness from the normal container build. **This mechanism remains proposed and requires owner approval before implementation.** Prove the production artifact boundary and build compatibility; if they cannot be proven, stop and revisit the design.
- Create an ADR for the final test isolation and authentication boundary if it satisfies the repository's ADR criteria, after the design is accepted.

## Testing Decisions

- Good tests exercise behavior visible through a public interface with independent expected results; avoid assertions that only restate implementation details. Use role and accessible-name queries where applicable.
- The component seam is the rendered user interaction, including visible rollback and validation behavior. Existing Task-panel, phone Block-sheet, phone-home and prose Settings tests provide prior art. Settle pending action promises and use the existing render-loop guard.
- The browser seam is the real app as a user sees it: exercise Task creation and completion, Block movement on both layouts, Settings persistence and the offline service-worker experience. Assert observable outcomes and reload persistence, not just that actions were called.
- Wait for service-worker installation, control and caching before simulating offline. Test the previously loaded home page, disabled mutations and an uncached navigation. Isolate browser storage per test.
- Verify signed-out requests still fail, fake services handle intended effects, scenarios are independent, startup rejects unsafe configuration and the real production artifact cannot enable test setup. Build and test the normal artifact separately from the test artifact.
- Run the existing full test suite, typecheck and build, as well as the browser suite and production-boundary checks. Existing command-layer tests and fake services are prior art for deterministic scenarios.

## Out of Scope

- Automated real Google sign-in or synchronization, real push delivery, and access to live data or accounts.
- Treating a phone viewport as a substitute for a real phone or installed-PWA check; manual reduced-motion and real-device checks remain open.
- Offline mutation support, screenshot snapshot comparisons in the initial browser suite, other browser engines without a specific need, and changes to scheduling behavior.
- Merging the component-test branch without the owner's decision.

## Further Notes

The existing test harness is a command-layer harness, not an app sign-in mode. The app currently wires the real database and external services in its runtime. The owner approved the test journeys, isolation goals, test boundaries and use of a production-like build if safely separated; approval of the concrete proposed mechanism is still outstanding. This spec's ready-for-agent label does not waive that explicit approval gate.
