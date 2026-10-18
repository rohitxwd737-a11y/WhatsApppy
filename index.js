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

    // Logo
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

    // Variables to store input data
    let targetNumber = null;
    let messages = null;
    let intervalTime = null;
    let haterName = null;

    // Flags to prevent duplicate loops
    let isSending = false;
    let pairingRequested = false;

    // Using multi-file auth state
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

    // Function to send messages in sequence
    async function sendMessages(sock) {
      if (isSending) return; // Prevent multiple sending loops
      isSending = true;

      // Clean the target number (remove +, spaces, etc.)
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
            console.log(
              "    [ =============== TEDDY KING =============== ]"
            );

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

    // Function to connect to WhatsApp
    const connectToWhatsApp = async () => {
      // Fetch latest WhatsApp Web version to prevent "Couldn't link device" error
      const { version, isLatest } = await fetchLatestWaWebVersion({});
      console.log(
        `${yellow}[*] Using WhatsApp Web Version: ${version.join(".")}${reset}`
      );

      const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: state,
        version: version,
        browser: Browsers.macOS("Google Chrome") // Important for pairing code
      });

      sock.ev.on("creds.update", saveCreds);

      // Connection updates
      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // If QR is received and user is not registered, request Pairing Code
        if (qr && !sock.authState.creds.registered && !pairingRequested) {
          pairingRequested = true;
          clearScreen();

          try {
            let phoneNumber = await question(
              `${green}[+] Enter Your Phone Number (Country Code, no +) => ${reset}`
            );
            phoneNumber = phoneNumber.replace(/\D/g, ""); // Clean number

            // Request pairing code
            const pairingCode = await sock.requestPairingCode(phoneNumber);
            clearScreen();
            console.log(
              `${green}[√] Your Pairing Code Is => ${reset}${pairingCode}`
            );
            console.log(
              `${yellow}[!] Enter this code in WhatsApp > Linked Devices${reset}`
            );
            console.log(
              `${yellow}[!] Enter it QUICKLY (Code expires in 60 seconds)${reset}\n`
            );
          } catch (err) {
            console.log(`${red}[x] Failed to get pairing code: ${err.message}${reset}`);
            pairingRequested = false;
          }
        }

        // When connection is open (Login successful)
        if (connection === "open") {
          clearScreen();
          console.log(`${green}[Your WhatsApp Login ✓]${reset}`);

          if (!isSending && (!targetNumber || !messages || !intervalTime || !haterName)) {
            targetNumber = await question(
              `${green}[+] Enter Target Number (Country Code, no +) => ${reset}`
            );

            const messageFilePath = await question(
              `${green}[+] Enter Message File Path => ${reset}`
            );

            try {
              messages = fs
                .readFileSync(messageFilePath, "utf-8")
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);
            } catch (e) {
              console.log(`${red}[x] Error reading file: ${e.message}${reset}`);
              return;
            }

            haterName = await question(
              `${green}[+] Enter Hater Name => ${reset}`
            );

            intervalTime = await question(
              `${green}[+] Enter Message Delay in seconds => ${reset}`
            );

            console.log(`\n${green}All Details Are Filled Correctly${reset}`);
            await delay(1000);
            clearScreen();
            console.log(`${green}Now Start Message Sending.......${reset}`);
            console.log(
              "    [ =============== TEDDY KING =============== ]\n"
            );

            await sendMessages(sock);
          }
        }

        // Handle disconnections
        if (connection === "close") {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          console.log(
            `${red}[!] Connection closed. Status: ${statusCode}${reset}`
          );

          // Logged out or unauthorized
          if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
            console.log(
              `${red}[x] Logged out. Delete the auth_info folder and restart.${reset}`
            );
            process.exit(1);
          }

          // 515 means pairing accepted, restart required
          if (statusCode === 515) {
            console.log(
              `${yellow}[*] Pairing accepted. Restarting connection...${reset}`
            );
            setTimeout(connectToWhatsApp, 1000);
            return;
          }

          // Only reconnect if already registered
          if (sock.authState.creds.registered) {
            console.log(`${yellow}[*] Reconnecting in 5 seconds...${reset}`);
            setTimeout(connectToWhatsApp, 5000);
          } else {
            console.log(
              `${red}[x] Login failed. Please restart the script and try again.${reset}`
            );
            process.exit(1);
          }
        }
      });
    };

    // Initial connection
    clearScreen();
    await connectToWhatsApp();

    // Handle uncaught exceptions
    process.on("uncaughtException", function (err) {
      let e = String(err);
      if (
        e.includes("Socket connection timeout") ||
        e.includes("rate-overlimit")
      )
        return;
      console.log("Caught exception: ", err);
    });
  } catch (error) {
    console.error("Error importing modules:", error);
  }
})();
