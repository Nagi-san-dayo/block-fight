const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// フロントエンドの静的ファイルを配信（Renderデプロイ用）
app.use(express.static(path.join(__dirname, 'public')));

const rooms = {}; // ルーム管理用オブジェクト

io.on('connection', (socket) => {
    console.log('ユーザーが接続しました:', socket.id);

    // ルーム作成または参加
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        
        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }
        
        // 既に2人いる場合は入れない
        if (rooms[roomId].length >= 2) {
            socket.emit('roomFull');
            return;
        }

        rooms[roomId].push(socket.id);
        console.log(`ユーザー ${socket.id} がルーム ${roomId} に参加しました。`);

        // 1人目の場合は P1、2人目の場合は P2 として設定
        const playerType = rooms[roomId].length === 1 ? 'p1' : 'p2';
        socket.emit('playerAssigned', playerType);

        // 2人揃ったらゲーム開始イベントを送信
        if (rooms[roomId].length === 2) {
            io.to(roomId).emit('matchStart');
        }
    });

    // プレイヤーのデータ（座標、状態など）を受信して相手に転送
    socket.on('playerUpdate', (data) => {
        // data = { roomId, playerType, x, y, state, ... }
        socket.to(data.roomId).to(data.roomId).emit('opponentUpdate', data);
    });

    // 攻撃や飛び道具の発動を同期
    socket.on('playerAttack', (data) => {
        socket.to(data.roomId).emit('opponentAttack', data);
    });

    // 切断時の処理
    socket.on('disconnect', () => {
        console.log('ユーザーが切断しました:', socket.id);
        for (const roomId in rooms) {
            rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
            if (rooms[roomId].length === 0) {
                delete rooms[roomId];
            } else {
                io.to(roomId).emit('opponentDisconnected');
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました`);
});
