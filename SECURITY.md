# Security

## Reporting a problem

Please do not open a public issue for a security problem. Use GitHub's private reporting instead: open the **Security** tab of this repository and choose **Report a vulnerability**. Say what you found, how to repeat it, and what it could allow.

You will get a reply within a few days.

## What OpenPlan stores

- Plans are saved only in your browser (`localStorage`) and in files you choose to save. There is no account and no server for normal use.
- A **live session** sends the plan through a small relay, encrypted in your browser with a key that stays in the invite link after `#`. The relay only sees scrambled data, the room name, message sizes and timing. Anyone with the invite link can read and edit the plan, so share it only with the people who should have access.
- Anonymous visit counts are collected with cookie-free GoatCounter. Project data is never sent.
