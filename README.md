# pacochatxxx
PacoChatXXX is a multi-platform chat application connecting IRC, Discord, and a web-based chat interface in real-time. It ensures seamless message synchronization across platforms with automation for phrases, URLs, and time announcements. Simple to set up, it’s ideal for enhancing cross-platform communication.

PacoChatXXX Application: Description, Features, and Installation Guide
Description
PacoChatXXX is a multi-platform chat application that bridges communication between IRC, Discord, and a web-based chat interface. It provides a seamless way to synchronize conversations across these platforms, enabling users to interact in real-time from various endpoints.

Features
Platform Integration:

Bi-directional message synchronization between IRC, Discord, and the web interface.
Real-time updates for all connected clients.
Web Interface:

Simple and intuitive UI for chatting directly from a browser.
Displays active user lists in real-time.
Discord Bot:

Receives and sends messages from a specific Discord channel.
Integrates seamlessly with the IRC and web-based chat.
IRC Functionality:

Joins a predefined channel, relays messages, and updates connected users.
Each user is assigned a unique nickname upon connection.
Automation:

Periodic announcements, including random phrases, URLs, and the current time.
Scalability:

Uses Socket.IO for efficient, low-latency real-time communication.
Installation Guide
Requirements
A VPS running Debian 13.
Installed software:
Node.js (v18 or higher).
npm (Node Package Manager).
Git.
A registered bot on the Discord Developer Portal.
Installation Steps:

Update System and Install Dependencies

sudo apt update && sudo apt upgrade -y
sudo apt install nodejs npm git -y

Clone the Repository

git clone https://github.com/zcomv2/pacochatxxx.git
cd pacochatxxx

Install Node.js Dependencies

npm install express socket.io discord.js dotenv

Run the Application

node server.js

Test the Application

Access the web chat at http://<your-server-ip>:3003.
Verify that the bot joins the specified IRC and Discord channels.
Ensure messages synchronize across platforms.
