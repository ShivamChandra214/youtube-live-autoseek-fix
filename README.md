YouTube Live Auto-Seek — Stay Truly Live on Streams
📌 Overview

YouTube livestreams often fall a few seconds behind the true live edge due to network hiccups, buffering, or YouTube’s own adaptive latency controls.
This delay means you might miss critical moments — whether it’s a fast-moving gaming stream, a live trading chart, or breaking news.

This script automatically detects when you’ve drifted behind the live edge and intelligently seeks forward to keep you perfectly in sync — without buffering or accidentally skipping to the end screen.

It’s designed for use inside Enhancer for YouTube or any custom JavaScript injector in browsers like Brave, Chrome, or Firefox.

🚀 Features

Live-only detection — Works exclusively on YouTube livestreams, leaving regular videos untouched.

Accurate live position tracking — Calculates the real live edge in seconds, not just YouTube’s guess.

Safe seeking — Avoids the “black screen” or “end card” issue by never overshooting the buffer.

Dynamic offset tuning — Learns the safest seek distance to prevent buffering after each jump.

No over-seeking — Won’t move forward if the stream is already live (red dot active).

Minimal disruption — Seeks happen only when you’re a few seconds late, so you never miss dialogue or important audio.

Customizable thresholds — Fine-tune lag tolerance and safety offsets for your own connection.

🛠 How It Works

Live stream detection
The script checks the YouTube player to confirm if the current video is a livestream (via internal metadata).

Delay monitoring
It continuously compares:

The player’s current playback position (currentTime)

The real stream live edge (seekableEnd)
This difference is your lag.

Seek decision
If lag exceeds a set threshold (default: 2–3 seconds), the script seeks forward to the safe edge:

liveEdgeTime - safetyOffset


The safety offset prevents hitting an unbuffered segment and causing a stall.

Dynamic offset adjustment
If a seek causes buffering, the offset automatically increases next time.
If no buffering occurs for a while, the offset is reduced for a tighter live sync.

Cooldown system
After a seek, the script waits a short period before seeking again, preventing rapid jumps.

📂 Installation
Option 1: Enhancer for YouTube (Recommended)

Install Enhancer for YouTube extension.

Go to Enhancer settings → Custom scripts.

Paste the full script into the text area.

Save and refresh YouTube.

Option 2: Any JS Injector

Use an extension like Tampermonkey, Violentmonkey, or Custom JavaScript for Websites 2.

Create a new script, paste the code, and set it to run on https://www.youtube.com/*.

⚙️ Configuration

Inside the code, you’ll find a CONFIG object:

const CONFIG = {
    LAG_THRESHOLD: 2.5, // seconds behind live before seeking
    SAFETY_OFFSET: 1.2, // seconds away from edge after seek
    COOLDOWN_MS: 5000,  // min time between seeks
    DEBUG_UI: false     // turn debug overlay on/off
};


You can edit these values to suit your internet connection and tolerance for delay.

📸 Example Use Cases

Trading streams — Never miss a candlestick or sudden price spike.

Sports — Stay perfectly synced to live commentary and action.

Esports & Gaming — React to plays in real time without delay.

Live News — Hear breaking news the instant it’s broadcast.

🔍 Known Limitations

If your network has high packet loss or extreme jitter, the script may not be able to maintain perfect live sync without occasional buffering.

Works only on YouTube’s standard web player — not on embedded players or smart TV apps.

📜 License

This project is released under the MIT License.
You’re free to use, modify, and share it.
