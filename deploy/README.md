# Wall box: from zero to `npm run deploy`

This is the complete guide, starting from:

- a Windows PC on Wi-Fi, with this repo on it
- an OptiPlex 5050 Micro with a broken Ubuntu install and no internet
- an Ethernet cable already plugged in between the PC and the OptiPlex
- a downloaded Ubuntu Server `.iso` file

and ending with the calendar running full screen on the AOC, and `npm run deploy` on the PC
pushing new code to it.

**How to read this guide**

- **[PC]** means do it on your Windows PC. For terminal commands, use **PowerShell** (Windows
  Terminal) **inside the repo folder** `D:\dev\personal\wall-calendar`.
- **[BOX]** means do it on the OptiPlex, with its own keyboard and the AOC screen.
- `X` in an address like `192.168.137.X` means "the number you wrote down earlier".
- Copy commands exactly. Don't type the `$` or `>` prompt in front of a command.
- **If anything doesn't match what this guide says, stop** and paste what you see to Claude.

Total time: about 1–1.5 hours, mostly waiting.

---

## Part 1: What you need

- [ ] A **USB stick, 8GB or bigger**. **Everything on it will be erased.**
- [ ] A **USB keyboard** for the OptiPlex. You don't need a mouse.
- [ ] The **OptiPlex power brick**.
- [ ] The **AOC monitor**, its HDMI cable (portable monitors often use **mini-HDMI** on the
      monitor end, so use the cable that came with it), and a **USB-C charger** to power it.
- [ ] The Ethernet cable between the PC and the OptiPlex (already done).
- [ ] The Ubuntu Server ISO in your Downloads folder. Its name looks like
      `ubuntu-26.04-live-server-amd64.iso`. It must say **live-server** and **amd64**.
- [ ] Something to write on. You'll note down a password and an address.

---

## Part 2: Make the Ubuntu USB stick [PC]

1. Plug the USB stick into the PC.
2. Go to **https://rufus.ie**, scroll to **Download**, and download the newest **"Standard"**
   or **"Portable"** version. Either works.
3. Run the downloaded `rufus-x.x.exe`. Click **Yes** on the Windows permission prompt. If it
   asks about checking for updates online, either answer is fine.
4. In Rufus:
   - **Device:** your USB stick. Check the name and size; if there's more than one, make sure
     it's the stick and not another drive.
   - **Boot selection:** click **SELECT**, go to Downloads, and choose the
     `...live-server-amd64.iso` file.
   - **Partition scheme:** **GPT**
   - **Target system:** **UEFI (non CSM)**
   - Leave everything else as it is.
5. Click **START**.
   - If a box says **"ISOHybrid image detected"**, choose **"Write in ISO Image mode
     (Recommended)"** and click **OK**.
   - If a box warns **"ALL DATA ON DEVICE ... WILL BE DESTROYED"**, click **OK**.
6. Wait until the green bar says **READY** (about 2–5 minutes), then click **CLOSE**.
7. Leave the stick in the PC for now.

---

## Part 3: Share the PC's internet over the Ethernet cable [PC]

This makes the PC act like a router for the OptiPlex. The PC keeps its own Wi-Fi.

1. Press **Win + R**, type `ncpa.cpl`, and press **Enter**. A **"Network Connections"** window
   opens with an icon for each network adapter.
2. Find the two adapters you need:
   - The **Wi-Fi** one. It shows your home network's name under it. It might be called
     "Wi-Fi", "Wi-Fi 2", or similar.
   - The **Ethernet** one, which the cable to the OptiPlex is plugged into. It might say
     "Unidentified network" or "Network cable unplugged" (that's normal while the OptiPlex is
     off). It might be called "Ethernet", "Ethernet 2", or similar. **Note its exact name.**
3. **Right-click the Wi-Fi adapter → Properties.** Click **Yes** if Windows asks for permission.
4. Click the **Sharing** tab.
5. Check **"Allow other network users to connect through this computer's Internet
   connection"**.
6. In the **"Home networking connection"** dropdown below it, pick the **Ethernet** adapter
   from step 2. If there's no dropdown, there's only one other adapter and Windows picked it
   for you.
7. Leave **"Allow other network users to control or disable..."** as it is. Click **OK**.
8. If Windows says the adapter **"will be set to use IP address 192.168.137.1"**, click
   **Yes**.
9. Check that it worked. Open PowerShell and run:
   ```powershell
   ipconfig
   ```
   Under your Ethernet adapter, **IPv4 Address** should be **192.168.137.1**. It may not show
   up until the OptiPlex is turned on (Part 5); that's fine.

> **If you don't see a Sharing tab:** press Win + R, type `services.msc`, press Enter, find
> **Internet Connection Sharing (ICS)**, right-click it → **Properties**, set Startup type to
> **Manual**, click **Start**, then **OK**. Then try again from step 3.

---

## Part 4: Plug everything into the OptiPlex [BOX]

1. **Monitor:** run HDMI from the **HDMI port on the back of the OptiPlex** to the AOC's HDMI
   or mini-HDMI port.
2. **Monitor power:** plug the USB-C charger into **one** of the AOC's USB-C ports.
3. **Touch (optional for now):** if you have a data-capable USB-A-to-USB-C cable, connect the
   AOC's **other** USB-C port to a USB port on the OptiPlex. You can skip this until Part 13.
4. **Keyboard** into any USB port on the OptiPlex.
5. **The USB stick** from Part 2 into another USB port on the OptiPlex.
6. **Ethernet** stays plugged in.
7. **OptiPlex power brick** into the OptiPlex and the wall. **Don't turn it on yet.**

---

## Part 5: BIOS settings [BOX]

The BIOS is the setup screen built into the computer. These settings fix the most common
reasons Ubuntu boots badly on these Dells.

1. Press the OptiPlex's power button, then **immediately tap F2 about once a second** until a
   blue/grey **"BIOS Setup"** or **"Settings"** screen appears.
   - If you miss it and the broken Ubuntu starts loading, **hold the power button for 5
     seconds** to turn the box off, then try again.
2. You can use the keyboard (arrow keys, Enter, Tab, Space). A mouse also works if you have
   one. The menu is a tree on the left.
3. Make these changes:

   | Where (left menu) | Setting | Set it to |
   |---|---|---|
   | **General → Boot Sequence** | Boot List Option | **UEFI** |
   | **General → Advanced Boot Options** | Enable Legacy Option ROMs | **unchecked** |
   | **System Configuration → SATA Operation** | | **AHCI** (if it says "RAID On", change it and click **Yes/OK** on the warning; the disk is getting wiped anyway) |
   | **Secure Boot → Secure Boot Enable** | | leave as is (Ubuntu works either way) |
   | **Power Management → AC Recovery** | | **Power On** (the calendar comes back by itself after a power cut) |
   | **Power Management → Deep Sleep Control** | | **Disabled** |

   If you can't find one of these, skip it, except **SATA Operation → AHCI**, which matters.
4. Click **Apply** (bottom right) and confirm, then click **Exit**. The box restarts.

---

## Part 6: Boot the Ubuntu installer [BOX]

1. As the box restarts, **tap F12 about once a second** until the **"Boot menu"** /
   **"One-Time Boot Settings"** list appears.
2. Under **UEFI BOOT**, pick your USB stick with the arrow keys. It's usually listed by brand,
   e.g. "UEFI: SanDisk...". Press **Enter**.
   - **If the stick isn't listed:** turn the box off, move the stick to another USB port, and
     try again. If it's still missing, go back into BIOS (Part 5), set **Secure Boot Enable**
     to **off**, and try again.
3. A black menu appears. Pick **"Try or Install Ubuntu Server"** and press **Enter**. It also
   starts on its own after 30 seconds.
4. Text scrolls by for a minute or two. Wait.

**How to use the installer:** **Arrow keys / Tab** move, **Enter** selects or presses a button,
**Space** checks or unchecks a box. The **[ Done ]** button at the bottom goes to the next
screen, and **[ Back ]** goes back.

---

## Part 7: Install Ubuntu, screen by screen [BOX]

1. **Language:** **English** → Enter.
2. **"Installer update available":** choose **"Continue without updating"**. If this screen
   doesn't appear, keep going.
3. **Keyboard configuration:** Layout **English (US)**, Variant **English (US)** → **Done**.
4. **Choose the type of installation:** keep **(X) Ubuntu Server** selected (NOT "minimized").
   Leave "Search for third-party drivers" **unchecked**. → **Done**.
5. **Network configuration:** you'll see the Ethernet adapter, named something like `eno1` or
   `enp0s31f6`, with **DHCPv4** and an address like **192.168.137.X/24**.
   - ✅ **If you see a 192.168.137.something address:** write it down, then choose **Done**.
   - If a **Wi-Fi** adapter (`wlp...`) is also listed, ignore it. Wi-Fi comes later.
   - ❌ **If the Ethernet adapter says "disabled", "not connected", or has no address:**
     wait 30 seconds. If there's still nothing, go to the PC, repeat Part 3 (uncheck the
     sharing box, OK, then check it again, OK), and come back. If there's *still* nothing, set
     it by hand: select the Ethernet adapter → Enter → **Edit IPv4** → Method **Manual**, then:
     - Subnet: `192.168.137.0/24`
     - Address: `192.168.137.50`
     - Gateway: `192.168.137.1`
     - Name servers: `192.168.137.1`
     - Search domains: blank

     Save → Done. Write down **192.168.137.50** as your address.
6. **Proxy configuration:** leave it blank → **Done**.
7. **Ubuntu archive mirror configuration:** wait until it says **"This mirror location passed
   tests"** → **Done**.
   - If it fails, the box has no internet. Go back to step 5 and the network fixes.
8. **Guided storage configuration:**
   - Keep **(X) Use an entire disk**.
   - In the disk list, pick the **OptiPlex's internal drive**, NOT the USB stick. The stick is
     the small one (8–64GB, named after its brand). The internal drive is the big one (128GB+,
     often an SSD/NVMe brand). **If you see two big drives, stop and ask.**
   - Keep **[X] Set up this disk as an LVM group** checked.
   - Leave **[ ] Encrypt the LVM group** **unchecked**. The wall has to boot without anyone
     typing a password.
   - → **Done**.
9. **Storage configuration (summary):** Ubuntu only uses about 100GB of the drive by default.
   Fix that:
   - Under **USED DEVICES**, find the line **`ubuntu-lv`** (under `ubuntu-vg`). Select it →
     **Enter** → **Edit**.
   - The **Size** field shows a hint like **(max 237.5G)**. Delete the number in the field and
     type the max number, e.g. `237.5G`. → **Save**.
   - → **Done**.
   - A red **"Confirm destructive action"** box appears. This erases the old broken Ubuntu.
     → **Continue**.
10. **Profile configuration:**
    - Your name: `Gage`
    - Your server's name: `wall`
    - Pick a username: `gage`
    - Choose a password / Confirm your password: **pick one and write it down.** You'll type
      it a lot.
    - → **Done**.
11. **Upgrade to Ubuntu Pro:** keep **(X) Skip for now** → **Continue**.
12. **SSH configuration:** **this one matters.**
    - Press **Space** on **[X] Install OpenSSH server** so it's checked.
    - Leave **"Allow password authentication over SSH"** checked.
    - Import SSH key: **No**.
    - → **Done**.
13. **Featured server snaps:** don't select anything → **Done**.
14. **Installing system:** text scrolls for 5–20 minutes. Wait until the top says
    **"Installation complete!"** and a **[ Reboot Now ]** button appears at the bottom. It
    might first say "Downloading and installing security updates"; let it finish.
15. Select **[ Reboot Now ]** → Enter.
16. When it says **"Please remove the installation medium, then press ENTER"**, **pull out the
    USB stick** and press **Enter**.

---

## Part 8: First login on the box [BOX]

1. The box boots. Text scrolls, then you see **`wall login:`**. If more text keeps printing
   after that (cloud-init messages), wait a few seconds and press **Enter** to get a clean
   `wall login:` prompt.
2. Type `gage` → Enter. Type your password → Enter. **Nothing shows while you type the
   password. That's normal.**
3. You'll see a prompt like `gage@wall:~$`. Find the box's address:
   ```sh
   ip -4 addr
   ```
   Look for the entry that isn't `lo`, e.g. `eno1`, and the line under it starting with
   **`inet 192.168.137.178/24`**. Make sure it matches what you wrote down; if it's different,
   **write down the new one.** That's the box's address on the cable.
4. Check internet:
   ```sh
   ping -c 3 ubuntu.com
   ```
   You should see 3 lines of `64 bytes from ...`. If you see "Temporary failure in name
   resolution" or "Network is unreachable", redo Part 3 on the PC (uncheck/recheck the sharing
   box), wait 30 seconds, and try again.

You're done typing on the box's keyboard for a while. Everything from here happens on the PC.

---

## Part 9: Connect to the box from the PC [PC]

1. Open **PowerShell** (Windows Terminal) and go to the repo:
   ```powershell
   cd D:\dev\personal\wall-calendar
   ```
2. Log in to the box remotely, replacing X with your number:
   ```powershell
   ssh gage@192.168.137.X
   ```
   - The first time, it asks **"Are you sure you want to continue connecting
     (yes/no/[fingerprint])?"** Type `yes` → Enter.
   - Type the box password → Enter.
   - The prompt changes to `gage@wall:~$`. **That means you're on the box.** Type `exit` →
     Enter to come back to the PC.
   - If you get **"REMOTE HOST IDENTIFICATION HAS CHANGED"**, run
     `ssh-keygen -R 192.168.137.X` and try again.
3. **Set up a key so you stop typing the password.** First check whether you already have one:
   ```powershell
   Test-Path $env:USERPROFILE\.ssh\id_ed25519.pub
   ```
   - If it prints **False**, make a key with the command below and press **Enter** at every
     question (3 times, leaving them all blank):
     ```powershell
     ssh-keygen -t ed25519
     ```
   - Copy the key to the box (enter the box password one last time):
     ```powershell
     type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh gage@192.168.137.X "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
     ```
4. **Give the box a nickname** so you can type `ssh wall` instead of the address. Open the SSH
   config file in VS Code:
   ```powershell
   code $env:USERPROFILE\.ssh\config
   ```
   Add this at the bottom, using your number, and save (Ctrl+S):
   ```
   Host wall
     HostName 192.168.137.X
     User gage
   ```
5. Test it:
   ```powershell
   ssh wall
   ```
   You should get `gage@wall:~$` with **no password**. Type `exit`.

---

## Part 10: Send the app to the box [PC]

1. **Make sure all code is committed.** Only committed code gets sent.
   ```powershell
   git status
   ```
   If it says anything other than **"nothing to commit, working tree clean"**, commit first:
   ```powershell
   git add -A
   git commit -m "Deploy scripts"
   ```
2. **Create an empty repo on the box** that you can push code into:
   ```powershell
   ssh wall "git init -b main ~/wall-calendar && git -C ~/wall-calendar config receive.denyCurrentBranch updateInstead && mkdir -p ~/wall-calendar/data"
   ```
   It should print `Initialized empty Git repository in /home/gage/wall-calendar/.git/`.
3. **Tell your PC's git about the box** (one time only):
   ```powershell
   git remote add wall wall:wall-calendar
   ```
4. **Push the code:**
   ```powershell
   git push wall main
   ```
   It ends with something like `* [new branch]  main -> main`.
5. **Check the files arrived:**
   ```powershell
   ssh wall "ls ~/wall-calendar"
   ```
   You should see `CLAUDE.md`, `deploy`, `package.json`, `src`, and so on. If you see only
   `data`, run `ssh wall "cd ~/wall-calendar && git checkout -f main"` and check again.
6. **Copy the settings file** (`.env` isn't in git, on purpose):
   ```powershell
   scp .env wall:wall-calendar/.env
   ```
   Then open `.env` in VS Code and check it has **`PORT=4000`** and **`DATA_DIR=./data`**. If
   you change anything, run the `scp` again.
7. **Optional but recommended: copy your current data.** This brings over your people,
   chores, meals, settings **and the Google connection**, so you skip Google sign-in later.
   - First **stop the dev server** if it's running (`npm start` window → **Ctrl+C**).
   - Then copy the database. If the second file doesn't exist, that line errors; ignore it.
     ```powershell
     scp data/wall.db wall:wall-calendar/data/wall.db
     scp data/wall.db-wal wall:wall-calendar/data/wall.db-wal
     ```

---

## Part 11: Run the setup script [PC → box]

1. Log in to the box and start setup:
   ```powershell
   ssh wall
   ```
   ```sh
   cd ~/wall-calendar
   sudo ./deploy/setup.sh
   ```
   Type the box password when it asks (`[sudo] password for gage:`).
2. It runs for **5–15 minutes**. You'll see cyan headings like `== Base packages`,
   `== Node 24`, `== Google Chrome`, `== App build`, and so on. Lots of text in between is
   normal.
   - **If it stops with an error** (red text, or it returns to the prompt without saying
     "Done."), copy the last ~30 lines and send them to Claude. The script is safe to run
     again after a fix.
3. It ends with **"Done. Next:"**. **Look at the AOC: the calendar should now be on it, full
   screen.**
4. Quick checks (still on the box):
   ```sh
   curl localhost:4000/api/health
   ```
   This should print something like `{"ok":true,"time":"..."}`.
   ```sh
   systemctl status wall-calendar --no-pager
   systemctl status wall-kiosk --no-pager
   ```
   Both should say **`active (running)`** in green.
   - If the AOC is black or still shows a login prompt, run
     `journalctl -u wall-kiosk -n 50 --no-pager` and send the output to Claude.

**What the setup installed:** the Indianapolis timezone, Node 24, Google Chrome, the cage
kiosk window manager, emoji and Inter fonts, Tailscale, Wi-Fi tools, and sqlite3. Plus three
background services:

| Service | Does |
|---|---|
| `wall-calendar` | runs the app on port 4000; restarts itself if it crashes |
| `wall-kiosk` | runs Chrome full screen on the AOC; waits for the app first |
| `wall-backup.timer` | backs up the database every night at 2:30, keeping 14 days |

---

## Part 12: Tailscale (reach the box from anywhere) [PC + box]

Right now the box only has an address on the cable to your PC. Tailscale gives it a permanent
address that works over Wi-Fi, from your phone, and from anywhere.

1. **[PC]** If Tailscale isn't on your PC yet, install it from **https://tailscale.com/download**
   and sign in.
2. **[PC → box]** In the `ssh wall` window:
   ```sh
   sudo tailscale up
   ```
   It prints a link like `https://login.tailscale.com/a/abc123...`. Select it with the mouse,
   copy it (Ctrl+C in Windows Terminal), open it in your PC browser, sign in **with the same
   account as your PC**, and click **Connect**. The terminal then says "Success."
3. Get the box's Tailscale address:
   ```sh
   tailscale ip -4
   ```
   It prints something like **`100.101.102.103`**. **Write it down.**
4. **[PC]** Go to **https://login.tailscale.com/admin/machines**, find **wall**, click the
   **`...`** menu at the right → **Disable key expiry**. Otherwise the box drops off Tailscale
   in about 6 months.
5. **[PC]** Point the `wall` nickname at the Tailscale address:
   ```powershell
   code $env:USERPROFILE\.ssh\config
   ```
   Change the `HostName` line to the 100.x address and save:
   ```
   Host wall
     HostName 100.101.102.103
     User gage
   ```
6. Test it with `ssh wall` (it should log in with no password), then `exit`.

---

## Part 13: First deploy, the goal ✅ [PC]

From the repo folder on the PC:

```powershell
npm run deploy
```

This pushes your latest commits to the box, then runs `npm ci`, builds, and restarts the app
there. It ends with **`Deployed <commit> <message>`**. If there were no new commits, the push
says "Everything up-to-date" and the rest still runs. That's fine.

**You can now deploy.** From here on, the routine is: make changes → `git commit` →
`npm run deploy`. The screen picks up UI changes at its 3am reload. To see them right away, run
`ssh wall "sudo systemctl restart wall-kiosk"`.

---

## Part 14: After that (when you're ready)

### Hardware checks (at the desk)

- **Touch:** connect the AOC's second USB-C port to the OptiPlex (Part 4, step 3) and tap
  around. If nothing responds, try the AOC's other USB-C port, or a different cable (many
  USB-C cables only carry power). To check from the terminal:
  `sudo libinput list-devices | grep -iA3 touch`.
- **Google** (only if you didn't copy `wall.db` in Part 10):
  1. **[PC]** Run `ssh -L 4000:localhost:4000 wall` and leave that window open.
  2. **[PC]** In your browser, open **http://localhost:4000/settings** and connect Google
     there.
- **Timer chime sound (HDMI audio):** on the box, run `aplay -l` to list sound devices. Look
  for lines with **HDMI**. Test each one (Ctrl+C stops it) until you hear the AOC speaker:
  ```sh
  speaker-test -D plughw:0,3 -c2 -t wav
  speaker-test -D plughw:0,7 -c2 -t wav
  speaker-test -D plughw:0,8 -c2 -t wav
  ```
  Then make the one that worked the default. This example uses device 3:
  ```sh
  printf 'defaults.pcm.card 0\ndefaults.pcm.device 3\n' | sudo tee /etc/asound.conf
  sudo systemctl restart wall-kiosk
  ```

### Wi-Fi (once the box has a Wi-Fi card or USB adapter)

1. Install the card or adapter (power the box off first), then power it back on. The
   Ethernet cable and the PC's internet sharing should both still be on.
2. `ssh wall`, then:
   ```sh
   cd ~/wall-calendar
   sudo ./deploy/wifi.sh "Your Wi-Fi Name"
   ```
   Type the Wi-Fi password when asked (nothing shows while typing). It should end with
   `... is up: 192.168.x.x`.
3. Unplug the Ethernet cable. On the PC, turn off sharing (Part 3, uncheck the box).
4. `ssh wall "sudo reboot"`. Wait 2 minutes. The AOC should come back to the calendar with
   weather loading (weather loading means the internet works). `ssh wall` should still work,
   over Tailscale.

### Put it on the wall

1. `ssh wall "sudo poweroff"` and wait for the box's light to go off.
2. Mount the box on its bracket (vents clear) and mount the AOC.
3. Plug in the power, HDMI, touch USB-C, and the AOC's charger. The box turns on by itself
   when it gets power (AC Recovery), and boots to the calendar.

---

## Day-to-day reference

| Want to... | Run (on the PC) |
|---|---|
| Deploy new code | `npm run deploy` |
| Log in to the box | `ssh wall` |
| Watch app logs | `ssh wall "journalctl -u wall-calendar -f"` |
| Watch screen/Chrome logs | `ssh wall "journalctl -u wall-kiosk -f"` |
| Restart the screen | `ssh wall "sudo systemctl restart wall-kiosk"` |
| Restart the app | `ssh wall "sudo systemctl restart wall-calendar"` |
| Reboot the box | `ssh wall "sudo reboot"` |
| See backups | `ssh wall "ls ~/wall-calendar/data/backups"` |

On the box itself, **Ctrl+Alt+F2** on a USB keyboard switches from the calendar to a text
login, and **Ctrl+Alt+F1** goes back.
