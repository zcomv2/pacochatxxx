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
const DISCORD_TOKEN = "YOUR_TOKEN_ID_HERE";
const DISCORD_CHANNEL_ID = "YOUR_CHANNEL_ID_HERE";
const discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

let globalNickList = []; // Lista global de nicks actualizada

// Inicializar conexión principal del bot de Discord y al IRC
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

  // Solicitar lista de nicks periódicamente
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
      } else if (message.includes(`PRIVMSG`)) {
        const sender = message.split('!')[0].split(':')[1].trim();
        const userMessage = message.split(`:`).slice(2).join(':').trim();

        // Verificar si el mensaje ya contiene etiquetas y evitar duplicados
        if (!userMessage.startsWith('[WebAppChat]') && !userMessage.startsWith('[Discord]')) {
          io.emit('chat message', `[IRC] ${sender}: ${userMessage}`);
          const discordChannel = discordClient.channels.cache.get(DISCORD_CHANNEL_ID);
          if (discordChannel) {
            discordChannel.send(`[IRC] ${sender}: ${userMessage}`).catch(err => console.error('Error enviando mensaje a Discord:', err));
          }
        }
      }
    });
  });

  // Manejar mensajes desde Discord
  discordClient.on('messageCreate', async (message) => {
    if (message.author.bot || message.channel.id !== DISCORD_CHANNEL_ID) return;

    const discordMessage = `[Discord] ${message.author.username}: ${message.content}`;

    // Reenviar a IRC y WebAppChat sin duplicar
    io.emit('chat message', discordMessage);
    if (ircClient.writable) {
      ircClient.write(`PRIVMSG ${CHANNEL} :${discordMessage}\r\n`);
    }
  });

  // Inicializar el bot
  const bot = new Bot(io, ircClient, discordClient, DISCORD_CHANNEL_ID);

  // Iniciar tareas programadas
  console.log('Iniciando tareas programadas del bot...');
  bot.startBot();
});

// Manejar conexiones desde la WebAppChat
io.on('connection', (socket) => {
  console.log('Un usuario se ha conectado.');

  // Generar un nick único para el usuario
  const userNick = `Tek${Math.floor(Math.random() * 100)}`;

  // Crear conexión IRC para este usuario
  const userIrcClient = tls.connect(IRC_PORT, IRC_SERVER, () => {
    console.log(`Usuario ${userNick} conectado al IRC.`);
    userIrcClient.write(`NICK ${userNick}\r\n`);
    userIrcClient.write(`USER ${userNick} 0 * :WebAppChat User\r\n`);
    userIrcClient.write(`JOIN ${CHANNEL}\r\n`);
  });

  userIrcClient.on('error', (err) => {
    console.error(`Error en la conexión IRC para ${userNick}:`, err);
  });

  userIrcClient.on('data', (data) => {
    const messages = data.toString().split('\r\n');
    messages.forEach((message) => {
      if (message.includes(`PRIVMSG`) && !message.includes(userNick)) {
        const sender = message.split('!')[0].split(':')[1].trim();
        const userMessage = message.split(`:`).slice(2).join(':').trim();
        if (!userMessage.startsWith('[WebAppChat]') && !userMessage.startsWith('[Discord]')) {
          io.emit('chat message', `[IRC] ${sender}: ${userMessage}`);
        }
      }
    });
  });

  // Manejar mensajes enviados desde el cliente web
  socket.on('send message', (msg) => {
    if (userIrcClient && userIrcClient.writable) {
      const formattedMessage = `[WebAppChat] ${userNick}: ${msg}`;
      userIrcClient.write(`PRIVMSG ${CHANNEL} :${formattedMessage}\r\n`);

      // Emitir mensaje localmente solo una vez
      socket.emit('chat message', formattedMessage);

      // Enviar el mensaje también a Discord
      const discordChannel = discordClient.channels.cache.get(DISCORD_CHANNEL_ID);
      if (discordChannel) {
        discordChannel.send(formattedMessage).catch(err => console.error('Error enviando mensaje a Discord:', err));
      }
    } else {
      console.error('La conexión IRC del usuario no está disponible.');
    }
  });

  socket.on('disconnect', () => {
    console.log(`Usuario ${userNick} desconectado.`);
    if (userIrcClient) userIrcClient.end();
  });
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

