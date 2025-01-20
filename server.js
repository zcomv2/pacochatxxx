const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const tls = require('tls');
const crypto = require('crypto');
const { Client, GatewayIntentBits } = require('discord.js');
const Bot = require('./bot');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Configuración del servidor IRC
const IRC_SERVER = "irc.libera.chat";
const IRC_PORT = 6697;
const CHANNEL = "#parati";

// Configuración del bot de Discord
const DISCORD_TOKEN = "HERE-Token-ID";
const DISCORD_CHANNEL_ID = "HERE-Channel-ID";
const discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Conexión compartida al IRC para mensajes de Discord
const ircClient = tls.connect(IRC_PORT, IRC_SERVER, () => {
  console.log(`Conexión global al IRC establecida como ${CHANNEL}`);
  ircClient.write(`NICK PacochatBot\r\n`);
  ircClient.write(`USER PacochatBot 0 * :Discord Relay\r\n`);
  ircClient.write(`JOIN ${CHANNEL}\r\n`);
});

ircClient.on('error', (err) => {
  console.error('Error en la conexión IRC global:', err);
});

// Lista global de usuarios conectados al canal
let globalNickList = [];

// Generar un nick aleatorio
const generateNick = () => `Tek${crypto.randomInt(1000, 9999)}`;

// Escanear la lista de usuarios conectados cada 30 segundos
setInterval(() => {
  ircClient.write(`NAMES ${CHANNEL}\r\n`);
}, 30000);

ircClient.on('data', (data) => {
  const messages = data.toString().split('\r\n');
  messages.forEach((message) => {
    if (message.includes(`353`)) { // Código de respuesta NAMES
      const users = message.split(':').pop().trim().split(' ');
      globalNickList = Array.from(new Set(users)); // Actualizar sin duplicados
      io.emit('user list', globalNickList); // Enviar la lista actualizada a todos los clientes
    }
  });
});

// Manejo de eventos de Socket.IO
io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado.');

  // Crear una conexión única al IRC para este usuario
  let userNick = generateNick();
  const userIRCClient = tls.connect(IRC_PORT, IRC_SERVER, () => {
    console.log(`Conectado al servidor IRC como ${userNick}`);
    userIRCClient.write(`NICK ${userNick}\r\n`);
    userIRCClient.write(`USER ${userNick} 0 * :Node.js IRC Client\r\n`);
    userIRCClient.write(`JOIN ${CHANNEL}\r\n`);

    // Mensaje de estado inicial
    socket.emit('chat message', `System status: Connected to ${CHANNEL} as ${userNick}`);
  });

  userIRCClient.on('data', (data) => {
    const messages = data.toString().split('\r\n');
    messages.forEach((message) => {
      if (!message) return;

      console.log(`Mensaje del IRC para ${userNick}:`, message);

      // Procesar mensajes del canal IRC
      const privmsgMatch = message.match(/^:([^!]+)![^ ]+ PRIVMSG #[^\s]+ :(.*)$/);
      if (privmsgMatch) {
        const senderNick = privmsgMatch[1];
        const chatMessage = privmsgMatch[2];
        console.log(`Mensaje del canal procesado: ${senderNick}: ${chatMessage}`);
        socket.emit('chat message', `${senderNick}: ${chatMessage}`);

        // Enviar mensaje a Discord
        const discordChannel = discordClient.channels.cache.get(DISCORD_CHANNEL_ID);
        if (discordChannel && senderNick !== "PacochatBot") { // Evitar mensajes duplicados
          discordChannel.send(`[IRC] ${senderNick}: ${chatMessage}`);
        }
      }
    });
  });

  socket.on('send message', (msg) => {
    if (userIRCClient) {
      const ircMessage = `PRIVMSG ${CHANNEL} :${msg}\r\n`;
      userIRCClient.write(ircMessage);
      socket.emit('chat message', `Tú (${userNick}): ${msg}`);

      // Enviar mensaje a Discord
      const discordChannel = discordClient.channels.cache.get(DISCORD_CHANNEL_ID);
      if (discordChannel) {
        discordChannel.send(`[IRC] ${userNick}: ${msg}`);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Cliente desconectado, cerrando conexión IRC para ${userNick}`);
    if (userIRCClient) {
      userIRCClient.write(`QUIT :User disconnected\r\n`);
      userIRCClient.end();
    }

    globalNickList = globalNickList.filter((nick) => nick !== userNick);
    io.emit('user list', globalNickList);
  });
});

// Manejar eventos de Discord
discordClient.on('messageCreate', async (message) => {
  if (message.author.bot || message.channel.id !== DISCORD_CHANNEL_ID) return;

  console.log(`Mensaje recibido en Discord: ${message.author.username}: ${message.content}`);

  // Enviar mensaje al canal IRC
  const ircMessage = `PRIVMSG ${CHANNEL} :[Discord] ${message.author.username}: ${message.content}\r\n`;
  ircClient.write(ircMessage);

  // Emitir mensaje en Socket.IO para los clientes web
  io.emit('chat message', `[Discord] ${message.author.username}: ${message.content}`);
});

// Iniciar el bot de Discord
discordClient.login(DISCORD_TOKEN).then(() => {
  console.log('Bot de Discord conectado.');
});

// Inicializar el bot
const bot = new Bot(io);

// Servidor escuchando
const PORT = 3003;
server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
