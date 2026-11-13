# Security

Reins lets an AI drive a website, so its safety barriers are the core of the project. Reviews and attempts to break them are welcome.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue, so that users can be protected before the details are known.

A useful report includes:

- what an attacker can do, and what they need first (a page they control, a tab already paired…);
- the steps to reproduce it, with the package versions;
- any proof of concept, kept as small as possible.

## In scope

- Getting a form submitted without the user saying the confirmation code shown on screen.
- Making the AI follow instructions written in page content (prompt injection) despite the content markers.
- Pairing a tab, or reusing a token, without seeing the code on the user's screen.
- Reaching the bridge from a website or origin that was not allowed with `--allow-origin`, or from outside `127.0.0.1`.
- Making the page navigate to a screen the app did not define, or to an external URL.
- Getting hidden text, HTML or data the app did not hand over out of the page through the AI.
- The voice server sending audio or transcripts off the user's machine.

## Out of scope

- Attacks that need the user's machine, browser or AI client to be compromised already.
- Instructions the user gives to their own AI.
- Weaknesses in a specific AI model that Reins does not control, unless a Reins barrier should have stopped them.
- Bugs in the example apps (`apps/demo`, `apps/demo-api`) that do not affect the published packages.

## Supported versions

Security fixes are released for the latest published version of the `@reins-ai/*` packages.

## How it is designed

The security model, with every barrier and why it exists, is documented at [developers.sanoriva.com/reins/security](https://developers.sanoriva.com/reins/security).
