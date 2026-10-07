# Fragment size spike (PLAY-006)

How much data a cross-origin navigation can carry in a URL fragment, for the Chi è? handoff (spec 5.3).

## Results

| Browser | 100 KB | 500 KB | 1 MB | 2 MB | 4 MB | 8 MB | Run |
|---|---|---|---|---|---|---|---|
| Chromium (Playwright 1.63, desktop) | yes | yes | yes | no | no | no | Wed Oct 7 2026 |
| WebKit (Playwright 1.63, desktop) | yes | yes | yes | no | no | no | Wed Oct 7 2026 |
| Safari, real iPhone | | | | | | | TBD |
| Chrome, real Android phone | | | | | | | TBD |

"no" means the navigation never arrived (the browser refused it), not that data arrived damaged. No size arrived damaged.

## Running it on a real phone

The phone and the Mac must be on the same Wi-Fi.

1. On the Mac, from this folder, start two web servers, one per origin:

   ```bash
   python3 -m http.server 8000 --bind 0.0.0.0
   ```

   ```bash
   python3 -m http.server 8001 --bind 0.0.0.0
   ```

   `python3 -m http.server 8000` serves this folder on port 8000; `--bind 0.0.0.0` makes it reachable from other devices on the network, not just the Mac. Run each in its own terminal tab.

2. Find the Mac's address on the network:

   ```bash
   ipconfig getifaddr en0
   ```

   `ipconfig getifaddr en0` prints the Mac's IP address on its Wi-Fi interface (`en0`), for example `192.168.1.20`.

3. On the phone, open `http://<that address>:8000/sender.html?to=http://<that address>:8001` and tap Start. The table fills in as each size returns. A size that never comes back within about 20 seconds was refused; reload the sender page and the table shows the sizes that worked.

4. Write the results into the table above and into spec 5.3, then stop both servers with Ctrl+C.
