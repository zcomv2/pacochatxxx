const fs = require('fs');
const https = require('https');
const tls = require('tls'); // Para conexión persistente al IRC

class Bot {
  constructor(io, ircClient, discordClient, discordChannelId) {
    this.io = io;
    this.ircClient = ircClient;
    this.discordClient = discordClient;
    this.discordChannelId = discordChannelId;
    this.urls = this.loadFile('lista-urls.txt');
    this.phrases = [];
    this.loadPhrasesFromURL('https://lab.psy-k.org/fotos/frases.txt', true);
    this.startBot();
  }

  loadFile(filename) {
    try {
      const content = fs.readFileSync(filename, 'utf8');
      return content.split('\n').filter(line => line.trim() !== '');
    } catch (err) {
      console.error(`Error loading file ${filename}:`, err);
      return [];
    }
  }

  loadPhrasesFromURL(url, ignoreCert) {
    const options = ignoreCert ? { rejectUnauthorized: false } : {};

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        this.phrases = data.split('\n').filter(line => line.trim() !== '' && !line.startsWith('<'));
        console.log('Phrases loaded successfully from URL.');
      });
    }).on('error', (err) => {
      console.error(`Error fetching phrases from ${url}:`, err);
    });
  }

  getRandomItem(array) {
    if (array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
  }

  announceTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const message = `El bot dice: La hora actual es ${timeString}`;
    this.broadcastMessage(message);
  }

  shareRandomUrl() {
    const url = this.getRandomItem(this.urls);
    if (url) {
      const message = `El bot comparte: ${url}`;
      this.broadcastMessage(message);
    } else {
      console.error('No URLs available to share.');
    }
  }

  shareRandomPhrase() {
    const phrase = this.getRandomItem(this.phrases);
    if (phrase) {
      const message = `El bot dice: ${phrase}`;
      this.broadcastMessage(message);
    } else {
      console.error('No phrases available to share.');
    }
  }

  sendToIRC(message) {
    if (this.ircClient && this.ircClient.writable) {
      this.ircClient.write(`PRIVMSG #parati :${message}\r\n`);
    } else {
      console.error('IRC client not writable.');
    }
  }

  sendToDiscord(message) {
    const channel = this.discordClient.channels.cache.get(this.discordChannelId);
    if (channel) {
      channel.send(message).catch(err => console.error('Error sending message to Discord:', err));
    } else {
      console.error('Discord channel not available or invalid ID.');
    }
  }

  broadcastMessage(message) {
    try {
      this.io.emit('chat message', message);
      this.sendToIRC(message);
      this.sendToDiscord(message);
    } catch (err) {
      console.error('Error broadcasting message:', err);
    }
  }

  startBot() {
    // Envía la hora cada minuto para pruebas
    setInterval(() => {
      try {
        this.announceTime();
      } catch (err) {
        console.error('Error announcing time:', err);
      }
    }, 60000); // Cada minuto

    // Envía una frase aleatoria cada minuto para pruebas
    setInterval(() => {
      try {
        this.shareRandomPhrase();
      } catch (err) {
        console.error('Error sharing random phrase:', err);
      }
    }, 60000); // Cada minuto

    // Envía un enlace aleatorio cada minuto para pruebas
    setInterval(() => {
      try {
        this.shareRandomUrl();
      } catch (err) {
        console.error('Error sharing random URL:', err);
      }
    }, 60000); // Cada minuto
  }
}

module.exports = Bot;
