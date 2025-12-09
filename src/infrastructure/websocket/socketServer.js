/**
 * WebSocket Server for Real-time Messaging
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { UserRepository, GroupMemberRepository } = require('../repositories');

class WebSocketServer {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.WS_CORS_ORIGIN || '*',
        methods: ['GET', 'POST']
      },
      // Heartbeat configuration to prevent disconnections
      pingTimeout: 60000,     // 60 seconds before considering connection dead
      pingInterval: 25000,    // Send ping every 25 seconds
      upgradeTimeout: 30000,  // 30 seconds to complete upgrade
      transports: ['polling', 'websocket'],
      allowUpgrades: true
    });


    this.userRepository = new UserRepository();
    this.groupMemberRepository = new GroupMemberRepository();
    this.connectedUsers = new Map();

    this.initialize();
  }

  initialize() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;

        if (!token) {
          console.log('❌ WebSocket: No token provided');
          return next(new Error('Token requerido'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('🔑 WebSocket Auth - Token decoded:', JSON.stringify(decoded));

        // Try multiple possible field names for profileId
        const profileId = decoded.profileId || decoded.profile_id || decoded.userId || decoded.id;

        socket.user = {
          id: decoded.id,
          profileId: profileId,
          username: decoded.username || decoded.email
        };

        console.log(`✅ WebSocket Auth - User: ${socket.user.profileId}`);

        next();
      } catch (error) {
        console.log(`❌ WebSocket Auth Error: ${error.message}`);
        next(new Error('Token inválido'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  handleConnection(socket) {
    const { profileId } = socket.user;
    console.log(`🔌 Usuario conectado: ${profileId}`);

    this.addConnection(profileId, socket.id);
    this.userRepository.setOnlineStatus(profileId, true);
    this.joinUserGroups(socket, profileId);

    // 🔥 Broadcast online status to all rooms user is part of
    this.broadcastUserStatus(profileId, true);

    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`📥 Usuario ${profileId} unido a conversación: ${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('join_group', (groupId) => {
      socket.join(`group:${groupId}`);
    });

    socket.on('leave_group', (groupId) => {
      socket.leave(`group:${groupId}`);
    });

    socket.on('typing_start', (data) => {
      const { conversationId, groupId } = data;
      const room = conversationId ? `conversation:${conversationId}` : `group:${groupId}`;
      socket.to(room).emit('user_typing', { profileId, isTyping: true });
    });

    socket.on('typing_stop', (data) => {
      const { conversationId, groupId } = data;
      const room = conversationId ? `conversation:${conversationId}` : `group:${groupId}`;
      socket.to(room).emit('user_typing', { profileId, isTyping: false });
    });

    // 🔥 Allow clients to check if a specific user is online
    socket.on('check_user_status', (targetProfileId) => {
      const isOnline = this.isUserOnline(targetProfileId);
      console.log(`🔍 User ${profileId} checking status of ${targetProfileId}: ${isOnline}`);
      socket.emit('user_status_response', { profileId: targetProfileId, isOnline });
    });

    socket.on('disconnect', () => {
      this.removeConnection(profileId, socket.id);

      if (!this.connectedUsers.has(profileId) || this.connectedUsers.get(profileId).size === 0) {
        this.userRepository.setOnlineStatus(profileId, false);
        // 🔥 Broadcast offline status
        this.broadcastUserStatus(profileId, false);
        console.log(`❌ Usuario desconectado: ${profileId}`);
      }
    });
  }

  addConnection(profileId, socketId) {
    if (!this.connectedUsers.has(profileId)) {
      this.connectedUsers.set(profileId, new Set());
    }
    this.connectedUsers.get(profileId).add(socketId);
  }

  removeConnection(profileId, socketId) {
    if (this.connectedUsers.has(profileId)) {
      this.connectedUsers.get(profileId).delete(socketId);
      if (this.connectedUsers.get(profileId).size === 0) {
        this.connectedUsers.delete(profileId);
      }
    }
  }

  async joinUserGroups(socket, profileId) {
    try {
      const result = await this.groupMemberRepository.findByProfileId(profileId, {
        status: 'active',
        limit: 100
      });

      for (const membership of result.data) {
        socket.join(`group:${membership.groupId}`);
      }
    } catch (error) {
      console.error('Error al unir grupos:', error);
    }
  }

  emitNewConversationMessage(conversationId, message) {
    this.io.to(`conversation:${conversationId}`).emit('new_message', message);
  }

  emitNewGroupMessage(groupId, message) {
    this.io.to(`group:${groupId}`).emit('new_message', message);
  }

  emitToUser(profileId, event, data) {
    const socketIds = this.connectedUsers.get(profileId);
    if (socketIds) {
      socketIds.forEach(socketId => {
        this.io.to(socketId).emit(event, data);
      });
    }
  }

  // 🔥 Broadcast user online status to all connected clients
  // Note: This broadcasts to everyone - for privacy, clients should filter
  // to only show status of users they have conversations with
  broadcastUserStatus(profileId, isOnline) {
    this.io.emit('user_status_changed', { profileId, isOnline });
    console.log(`📡 Status broadcast: ${profileId} -> ${isOnline ? 'online' : 'offline'}`);
  }


  // Check if user is currently online
  isUserOnline(profileId) {
    return this.connectedUsers.has(profileId) && this.connectedUsers.get(profileId).size > 0;
  }
}

let wsServerInstance = null;

const initializeWebSocket = (httpServer) => {
  if (!wsServerInstance) {
    wsServerInstance = new WebSocketServer(httpServer);
  }
  return wsServerInstance;
};

const getWebSocketServer = () => wsServerInstance;

module.exports = { WebSocketServer, initializeWebSocket, getWebSocketServer };