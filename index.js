(async () => {
  try {
    const {
      makeWASocket,
      useMultiFileAuthState,
      delay,
      DisconnectReason,
      Browsers,
      fetchLatestWaWebVersion
    } = await import("@whiskeysockets/baileys");

    const fs = await import("fs");
    const pino = (await import("pino")).default;
    const readline = await import("readline");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (text) =>
      new Promise((resolve) => rl.question(text, resolve));

    // ANSI color codes
    const reset = "\x1b[0m";
    const green = "\x1b[1;32m";
    const yellow = "\x1b[1;33m";
    const red = "\x1b[1;31m";

    // KRIX Logo
    const logo = `${green}
##.....##.########..####...##.....##
##...##..##.....##..##.....##...##.
##..##...##.....##..##.....##..##..
#####....########...##......###....
##..##...##...##....##.....##..##..
##...##..##....##...##....##....##.
##....##.##.....##.####...##.....##
============================================
[~] Author  : KRIX
[~] Tool    : KRIX WhatsApp Auto Sender
============================================${reset}`;

    const clearScreen = () => {
      console.clear();
      console.log(logo);
    };

    // Variables
    let targetNumber = null;
    let messages = null;
    let intervalTime = null;
    let haterName = null;

    let isSending = false;
    let pairingRequested = false;

    // Auth State
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

    // Message Sending Loop
    async function sendMessages(sock) {
      if (isSending) return;
      isSending = true;

      const cleanNumber = String(targetNumber).replace(/\D/g, "");
      const jid = `${cleanNumber}@s.whatsapp.net`;

      while (true) {
        for (const message of messages) {
          try {
            const currentTime = new Date().toLocaleTimeString();
            const fullMessage = `${haterName} ${message}`;

            await sock.sendMessage(jid, { text: fullMessage });

            console.log(`${green}Target Number => ${reset}${cleanNumber}`);
            console.log(`${green}Time => ${reset}${currentTime}`);
            console.log(`${green}Message => ${reset}${fullMessage}`);
            console.log(`    [ =============== KRIX =============== ]`);

            await delay(Number(intervalTime) * 1000);
          } catch (sendError) {
            console.log(`${red}Error sending: ${sendError.message}${reset}`);
            await delay(5000);
          }
        }
      }
    }

    // Connect to WhatsApp
    const connectToWhatsApp = async () => {
      // 1. Get Latest WA Version (Fixes the "Couldn't link device" error)
      const { version } = await fetchLatestWaWebVersion({});

      const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: state,
        version: version, 
        browser: Browsers.macOS("Google Chrome"), // Must be standard browser
      });

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Ask for pairing code if not registered
        if (qr && !sock.authState.creds.registered && !pairingRequested) {
          pairingRequested = true;
          clearScreen();
          
          try {
            let phoneNumber = await question(`${green}[+] Enter Your Phone Number (e.g., 919876543210) => ${reset}`);
            phoneNumber = phoneNumber.replace(/\D/g, ""); // Keep only digits

            const pairingCode = await sock.requestPairingCode(phoneNumber);
            
            clearScreen();
            console.log(`\n${green}[√] YOUR PAIRING CODE IS => ${reset}${yellow}${pairingCode}${reset}\n`);
            console.log(`${red}⚠️ WARNING: Enter this code in WhatsApp > Linked Devices > Link with phone number IMMEDIATELY! It expires in 60 seconds.${reset}`);
            
          } catch (err) {
            console.log(`${red}[x] Pairing failed: ${err.message}${reset}`);
            pairingRequested = false;
          }
        }

        // If connection opens (Login Successful)
        if (connection === "open") {
          clearScreen();
          console.log(`\n${green}[✓] WhatsApp Login Successful!${reset}\n`);

          if (!isSending && (!targetNumber || !messages || !intervalTime || !haterName)) {
            targetNumber = await question(`${green}[+] Enter Target Number => ${reset}`);
            const messageFilePath = await question(`${green}[+] Enter Message File Path => ${reset}`);
            
            try {
              messages = fs.readFileSync(messageFilePath, "utf-8").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            } catch (e) {
              console.log(`${red}[x] File Error: ${e.message}${reset}`);
              process.exit(1);
            }

            haterName = await question(`${green}[+] Enter Hater Name => ${reset}`);
            intervalTime = await question(`${green}[+] Enter Message Delay (seconds) => ${reset}`);

            clearScreen();
            console.log(`${green}[*] Starting message sending...${reset}\n`);
            await sendMessages(sock);
          }
        }

        // Handle Disconnections
        if (connection === "close") {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          
          if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
            console.log(`${red}[x] Logged out. Delete auth_info folder and restart.${reset}`);
            process.exit(1);
          }

          if (statusCode === 515) {
            // 515 means pairing was successful, we just need to reconnect
            setTimeout(connectToWhatsApp, 1000);
            return;
          }

          if (sock.authState.creds.registered) {
            console.log(`${yellow}[!] Network issue. Reconnecting in 5s...${reset}`);
            setTimeout(connectToWhatsApp, 5000);
          } else {
            console.log(`${red}[x] Connection closed. Restart script.${reset}`);
            process.exit(1);
          }
        }
      });
    };

    // Start
    clearScreen();
    await connectToWhatsApp();

    // Handle Errors
    process.on("uncaughtException", function (err) {
      let e = String(err);
      if (e.includes("Socket connection timeout") || e.includes("rate-overlimit")) return;
      console.log("Caught exception: ", err);
    });

  } catch (error) {
    console.error("Error importing modules:", error);
  }
})();
