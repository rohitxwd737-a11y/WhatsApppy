(async () => {
  try {
    const {
      makeWASocket,
      useMultiFileAuthState,
      delay,
      DisconnectReason,
      Browsers
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

    const reset = "\x1b[0m";
    const green = "\x1b[1;32m";
    const yellow = "\x1b[1;33m";

    const logo = `${green}
....###....##....##.##.....##..######..##.....##
...##.##....##..##..##.....##.##....##.##.....##
..##...##....####...##.....##.##.......##.....##
.##.....##....##....##.....##..######..#########
.#########....##....##.....##.......##.##.....##
.##.....##....##....##.....##.##....##.##.....##
.##.....##....##.....#######...######..##.....##
============================================
[~] Author  : SAMAR INSIDE
[~] GitHub  : samarinside143
[~] Tool    : Automatic WhatsApp Message Sender
============================================${reset}`;

    const clearScreen = () => {
      console.clear();
      console.log(logo);
    };

    let targetNumber = null;
    let messages = null;
    let intervalTime = null;
    let haterName = null;

    let isSending = false;
    let pairingRequested = false;

    const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

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
            console.log("    [ =============== TEDDY KING =============== ]");

            await delay(Number(intervalTime) * 1000);
          } catch (sendError) {
            console.log(
              `${yellow}Error sending message: ${sendError.message}. Retrying...${reset}`
            );
            await delay(5000);
          }
        }
      }
    }

    const connectToWhatsApp = async () => {
      const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: state,
        browser: Browsers.macOS("Google Chrome")
      });

      sock.ev.on("creds.update", saveCreds);

      // IMPORTANT: Register connection.update BEFORE requesting pairing code.
      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
          clearScreen();
          console.log(`${green}[Your WhatsApp Login ✓]${reset}`);

          if (!isSending) {
            if (!targetNumber || !messages || !intervalTime || !haterName) {
              targetNumber = await question(
                `${green}[+] Enter Target Number with country code, no + => ${reset}`
              );

              const messageFilePath = await question(
                `${green}[+] Enter Message File Path => ${reset}`
              );

              messages = fs
                .readFileSync(messageFilePath, "utf-8")
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);

              haterName = await question(
                `${green}[+] Enter Hater Name => ${reset}`
              );

              intervalTime = await question(
                `${green}[+] Enter Message Delay in seconds => ${reset}`
              );

              console.log(`${green}All Details Are Filled Correctly${reset}`);
              clearScreen();
              console.log(`${green}Now Start Message Sending.......${reset}`);
              console.log(
                "    [ =============== TEDDY KING =============== ]"
              );

              await sendMessages(sock);
            }
          }
        }

        if (connection === "close") {
          const statusCode = lastDisconnect?.error?.output?.statusCode;

          console.log(`${yellow}Connection closed. Status: ${statusCode}${reset}`);

          // Logged out or unauthorized
          if (
            statusCode === DisconnectReason.loggedOut ||
            statusCode === 401
          ) {
            console.log(
              `${yellow}Logged out. Delete the auth_info folder and restart the script.${reset}`
            );
            return;
          }

          // 515 means pairing accepted, restart required
          if (statusCode === 515) {
            console.log(
              `${yellow}Pairing accepted. Restarting connection...${reset}`
            );
            setTimeout(connectToWhatsApp, 1000);
            return;
          }

          // Only reconnect if the user is already registered
          if (sock.authState.creds.registered) {
            console.log(`${yellow}Reconnecting in 5 seconds...${reset}`);
            setTimeout(connectToWhatsApp, 5000);
          } else {
            console.log(
              `${yellow}Login not completed. Restart the script and pair again.${reset}`
            );
          }
        }
      });

      // Request pairing code only once and after the socket has time to initialize
      if (!sock.authState.creds.registered && !pairingRequested) {
        pairingRequested = true;

        try {
          clearScreen();
          await delay(2000);

          const phoneNumber = (
            await question(
              `${green}[+] Enter Your Phone Number with country code, no + => ${reset}`
            )
          ).replace(/\D/g, "");

          const pairingCode = await sock.requestPairingCode(phoneNumber);

          clearScreen();
          console.log(`${green}[√] Your Pairing Code Is => ${reset}${pairingCode}`);
          console.log(
            `${yellow}Enter this code in WhatsApp > Linked Devices > Link with phone number.${reset}`
          );
        } catch (err) {
          pairingRequested = false;
          console.log(
            `${yellow}Pairing code request failed: ${err.message}${reset}`
          );
        }
      }
    };

    await connectToWhatsApp();

    process.on("uncaughtException", (err) => {
      const e = String(err);

      if (
        e.includes("Socket connection timeout") ||
        e.includes("rate-overlimit")
      ) {
        return;
      }

      console.log("Caught exception: ", err);
    });
  } catch (error) {
    console.error("Error importing modules:", error);
  }
})();
