YouTube Live Auto-Seek Fix
Overview
When watching YouTube livestreams, buffering or temporary network drops can cause playback to fall several seconds (or more) behind the live edge.
YouTube’s default “Live” button turns grey when this happens, and you may end up missing real-time events — a major problem for time-sensitive content like trading streams, sports, or live news.

This JavaScript snippet automatically detects when a YouTube livestream is behind the live edge and gently seeks forward to keep playback in sync.
Unlike simple auto-seek scripts, this version:

Only runs on livestreams (no effect on normal videos).

Avoids seeking too far ahead (which could cause end screens or autoplay triggers).

Checks YouTube’s own live-dot status before deciding to seek.

Uses a dynamic, self-adjusting offset to avoid excessive buffering.

Prevents repeated unnecessary seeks when playback is already at the live edge.

Features
✅ Livestream detection — Works only on videos where isLiveContent is true.

✅ Safe forward seeking — Stops just short of the actual live point to avoid triggering YouTube’s end screen.

✅ Dynamic offset tuning — Learns the best “seconds behind live” threshold for your connection.

✅ Minimal disruption — Seeks only when delay exceeds 2–3 seconds.

✅ No false triggers — Won’t skip forward if the red “Live” dot is already active.

Why this is needed
YouTube’s livestream player does not automatically return to the live edge after a buffering delay.
While you can click the red “Live” button manually, that means:

You risk missing moments if you don’t notice the delay immediately.

In fast-paced livestreams (e.g., market trades, gameplays), even 3–4 seconds delay can be a big deal.

This script automates that process, ensuring you always stay truly live.

Installation
Option 1 — Using Enhancer for YouTube (recommended)
Install Enhancer for YouTube in Brave, Chrome, or Firefox.

Go to the extension’s Settings.

Find the “Custom JavaScript” section.

Paste the entire script (autoseek.js) into the box.

Save settings and refresh YouTube.

Option 2 — Using a Custom Script Injector
Install a userscript manager like Tampermonkey.

Create a new script.

Paste the code into it.

Save and enable.

How it works
Detect livestream — The script checks ytplayer.config.args or ytInitialPlayerResponse to confirm the video is live.

Monitor playback — Every 1 second, it compares:

video.duration (live edge position)

video.currentTime (your playback position)

Seek logic — If the delay exceeds the dynamic threshold (starting at 3 seconds), it seeks forward to duration - safeOffset.

Offset tuning — If seeking causes buffering, the script slightly increases the safe offset. If there’s no buffer, it reduces it for tighter sync.

Known limitations
Cannot prevent buffering entirely if your internet connection is unstable.

May need a short warm-up period for dynamic offset to stabilize.

If YouTube changes its livestream player API, minor adjustments may be needed.

License
This script is free to use, modify, and share under the MIT License. Attribution appreciated but not required.

Short GitHub tagline:

Keep YouTube livestreams perfectly in sync with the live edge — no more falling behind due to buffering.
