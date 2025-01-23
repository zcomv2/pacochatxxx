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
const DISCORD_TOKEN = "Your-Token-ID-HERE";
const DISCORD_CHANNEL_ID = "Your-Channel-ID-HERE";
const discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

let globalNickList = []; // Lista global de nicks actualizada

discordClient.once('ready', () => {
  console.log('Bot de Discord conectado y listo.');

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

  // Actualizar lista de usuarios conectados cada 30 segundos
  setInterval(() => {
    try {
      ircClient.write(`NAMES ${CHANNEL}\r\n`);
    } catch (err) {
      console.error('Error solicitando lista de nicks:', err);
    }
  }, 30000);

  ircClient.on('data', (data) => {
    const messages = data.toString().split('\r\n');
    messages.forEach((message) => {
      if (message.includes(`353`)) { // Código de respuesta NAMES
        const users = message.split(':').pop().trim().split(' ');
        globalNickList = Array.from(new Set(users)); // Actualizar sin duplicados
        io.emit('user list', globalNickList); // Enviar la lista actualizada a todos los clientes
        console.log('Lista de nicks actualizada:', globalNickList);
      }
    });
  });

  // Inicializar el bot
  const bot = new Bot(io, ircClient, discordClient, DISCORD_CHANNEL_ID);

  // Iniciar tareas programadas
  console.log('Iniciando tareas programadas del bot...');
  bot.startBot();
});

discordClient.on('messageCreate', async (message) => {
  if (message.author.bot || message.channel.id !== DISCORD_CHANNEL_ID) return;

  console.log(`Mensaje recibido en Discord: ${message.author.username}: ${message.content}`);

  // Enviar mensaje al canal IRC
  const ircMessage = `PRIVMSG ${CHANNEL} :[Discord] ${message.author.username}: ${message.content}\r\n`;
  ircClient.write(ircMessage);

  // Emitir mensaje en Socket.IO para los clientes web
  io.emit('chat message', `[Discord] ${message.author.username}: ${message.content}`);
});

// Manejar errores en Discord
discordClient.on('error', (err) => {
  console.error('Error en el cliente de Discord:', err);
});

discordClient.login(DISCORD_TOKEN).catch(err => {
  console.error('Error al iniciar sesión con el token de Discord:', err);
  process.exit(1);
});

// Servidor escuchando
const PORT = 3003;
server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
