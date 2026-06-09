/**
 * StudyRoom Socket Handler
 *
 * Implements real-time collaboration in study rooms:
 * - Room join/leave management
 * - Group text chat
 * - Server-authoritative synced Pomodoro study timer
 * - Shared whiteboard drawing broadcasts
 */

// In-memory room state management
const rooms = {};

const setupStudyRoomSocket = (io) => {
  io.on("connection", (socket) => {
    let currentRoomId = null;
    let currentUser = null;

    console.log(`[Socket] New connection established: ${socket.id}`);

    // User joins a room
    socket.on("join-room", ({ roomId, user, settings }) => {
      if (!roomId || !user) return;

      currentRoomId = roomId;
      currentUser = user;

      // Join the socket.io room channel
      socket.join(roomId);

      // Initialize room state if it doesn't exist
      if (!rooms[roomId]) {
        const workSecs = (settings && settings.study ? settings.study : 25) * 60;
        const breakSecs = (settings && settings.break ? settings.break : 5) * 60;
        rooms[roomId] = {
          roomId,
          members: [],
          host: socket.id,
          timer: {
            duration: workSecs,
            timeLeft: workSecs,
            isRunning: false,
            type: "work", // 'work' or 'break'
            workDuration: workSecs,
            breakDuration: breakSecs,
          },
          timerIntervalId: null,
        };
      }

      const room = rooms[roomId];

      // Check if user is already in members (to avoid duplicates on reconnect)
      const existingMember = room.members.find(
        (m) => m.userId === user.id || m.socketId === socket.id
      );

      if (!existingMember) {
        room.members.push({
          socketId: socket.id,
          userId: user.id || user._id,
          name: user.name || "Anonymous Student",
          avatar: user.avatar || null,
        });
      } else {
        existingMember.socketId = socket.id; // update socket id
      }

      // If room host disconnected, assign new host
      if (!room.host || !io.sockets.sockets.has(room.host)) {
        room.host = socket.id;
      }

      console.log(`[Socket] User ${user.name} joined room: ${roomId}`);

      // Notify everyone in the room of updated member list
      io.to(roomId).emit("room-update", {
        members: room.members,
        host: room.host,
        timer: room.timer,
      });

      // Send a system message to the room
      io.to(roomId).emit("chat-message", {
        id: `system-${Date.now()}`,
        senderName: "System",
        message: `${user.name || "A student"} has joined the study room.`,
        isSystem: true,
        timestamp: new Date(),
      });
    });

    // Chat Message
    socket.on("send-message", ({ message }) => {
      if (!currentRoomId || !currentUser) return;

      io.to(currentRoomId).emit("chat-message", {
        id: `msg-${Date.now()}-${socket.id}`,
        senderId: currentUser.id || currentUser._id,
        senderName: currentUser.name || "Anonymous",
        message,
        timestamp: new Date(),
      });
    });

    // Timer control (Host only)
    socket.on("timer-control", ({ action, duration, type, workDuration, breakDuration }) => {
      if (!currentRoomId) return;

      const room = rooms[currentRoomId];
      if (!room) return;

      // Allow room members to control, but log if it's the host or not
      const isHost = socket.id === room.host;

      if (action === "start") {
        if (!room.timer.isRunning) {
          room.timer.isRunning = true;
          startRoomTimer(currentRoomId, io);
        }
      } else if (action === "pause") {
        room.timer.isRunning = false;
        clearInterval(room.timerIntervalId);
        room.timerIntervalId = null;
      } else if (action === "reset") {
        room.timer.isRunning = false;
        clearInterval(room.timerIntervalId);
        room.timerIntervalId = null;
        room.timer.type = type || "work";
        if (duration) {
          room.timer.duration = duration * 60;
        } else {
          room.timer.duration = room.timer.type === "work"
            ? (room.timer.workDuration || 25 * 60)
            : (room.timer.breakDuration || 5 * 60);
        }
        room.timer.timeLeft = room.timer.duration;
      } else if (action === "update-settings") {
        room.timer.isRunning = false;
        clearInterval(room.timerIntervalId);
        room.timerIntervalId = null;
        
        if (workDuration) room.timer.workDuration = workDuration * 60;
        if (breakDuration) room.timer.breakDuration = breakDuration * 60;
        
        room.timer.duration = room.timer.type === "work"
          ? (room.timer.workDuration || 25 * 60)
          : (room.timer.breakDuration || 5 * 60);
        room.timer.timeLeft = room.timer.duration;
      }

      io.to(currentRoomId).emit("timer-update", room.timer);
    });

    // Whiteboard drawing synchronization
    socket.on("draw-line", (drawData) => {
      if (!currentRoomId) return;
      // Broadcast draw instructions to all other clients in the room
      socket.to(currentRoomId).emit("draw-line", drawData);
    });

    // Whiteboard clear canvas
    socket.on("clear-canvas", () => {
      if (!currentRoomId) return;
      io.to(currentRoomId).emit("clear-canvas");
    });

    // Disconnect handler
    const handleLeave = () => {
      if (!currentRoomId || !rooms[currentRoomId]) return;

      const roomId = currentRoomId;
      const room = rooms[roomId];

      // Remove member
      room.members = room.members.filter((m) => m.socketId !== socket.id);

      console.log(`[Socket] User left room: ${roomId}. Remaining members: ${room.members.length}`);

      if (room.members.length === 0) {
        // Clean up empty room
        clearInterval(room.timerIntervalId);
        delete rooms[roomId];
        console.log(`[Socket] Room ${roomId} is empty. Deleted room state.`);
      } else {
        // If host left, assign new host
        if (room.host === socket.id) {
          room.host = room.members[0].socketId;
        }

        // Notify room members
        io.to(roomId).emit("room-update", {
          members: room.members,
          host: room.host,
          timer: room.timer,
        });

        if (currentUser) {
          io.to(roomId).emit("chat-message", {
            id: `system-${Date.now()}`,
            senderName: "System",
            message: `${currentUser.name} has left the study room.`,
            isSystem: true,
            timestamp: new Date(),
          });
        }
      }
    };

    socket.on("leave-room", handleLeave);
    socket.on("disconnect", handleLeave);
  });
};

// Start server-side timer ticks
const startRoomTimer = (roomId, io) => {
  const room = rooms[roomId];
  if (!room) return;

  if (room.timerIntervalId) {
    clearInterval(room.timerIntervalId);
  }

  room.timerIntervalId = setInterval(() => {
    const activeRoom = rooms[roomId];
    if (!activeRoom || !activeRoom.timer.isRunning) {
      clearInterval(room.timerIntervalId);
      return;
    }

    if (activeRoom.timer.timeLeft > 0) {
      activeRoom.timer.timeLeft--;
      // Broadcast every second
      io.to(roomId).emit("timer-update", activeRoom.timer);
    } else {
      // Timer finished! Toggle types
      activeRoom.timer.isRunning = false;
      clearInterval(activeRoom.timerIntervalId);
      activeRoom.timerIntervalId = null;

      const wasWork = activeRoom.timer.type === "work";
      activeRoom.timer.type = wasWork ? "break" : "work";
      
      // Toggle to break duration or work duration
      const durationSecs = activeRoom.timer.type === "work"
        ? (activeRoom.timer.workDuration || 25 * 60)
        : (activeRoom.timer.breakDuration || 5 * 60);
      activeRoom.timer.duration = durationSecs;
      activeRoom.timer.timeLeft = activeRoom.timer.duration;

      io.to(roomId).emit("timer-complete", {
        type: activeRoom.timer.type,
        message: wasWork
          ? "Study session complete! Take a break."
          : "Break time is over. Time to study!",
      });

      io.to(roomId).emit("timer-update", activeRoom.timer);
    }
  }, 1000);
};

module.exports = setupStudyRoomSocket;
