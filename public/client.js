const socket = io();

// Escuchar mensajes del canal IRC, Discord y WebAppChat y mostrarlos en el chat
socket.on('chat message', (msg) => {
  if (!msg.startsWith('[WebAppChat]')) {
    addMessageToChatBox(msg);
  }
});

// Escuchar y actualizar la lista de usuarios conectados
socket.on('user list', (userList) => {
  const userBox = document.getElementById('user-box');
  userBox.innerHTML = ''; // Limpiar la lista actual

  // Verificar si la lista tiene usuarios antes de procesar
  if (userList && userList.length > 0) {
    userList.forEach((user) => {
      const userElement = document.createElement('p');
      userElement.textContent = user;
      userBox.appendChild(userElement);
    });
  } else {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = 'No hay usuarios conectados.';
    userBox.appendChild(emptyMessage);
  }
});

// Función para añadir un mensaje al cuadro de chat
function addMessageToChatBox(message) {
  const chatBox = document.getElementById('chat-box');

  if (chatBox) {
    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    chatBox.appendChild(messageElement);

    // Mantener el cuadro de chat en las últimas líneas
    chatBox.scrollTop = chatBox.scrollHeight;
  } else {
    console.error("Elemento 'chat-box' no encontrado. Revisa tu HTML.");
  }
}

// Enviar mensajes al servidor al hacer clic en el botón o pulsar Enter
document.getElementById('send-button').addEventListener('click', sendMessage);
document.getElementById('message-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    sendMessage();
  }
});

// Función para enviar un mensaje al servidor
function sendMessage() {
  const input = document.getElementById('message-input');
  const message = input.value.trim();

  if (message) {
    socket.emit('send message', message); // Enviar mensaje al servidor
    addMessageToChatBox(`[Tú]: ${message}`); // Mostrar el mensaje solo como enviado localmente
    input.value = ''; // Limpiar el campo de entrada
  }
}
