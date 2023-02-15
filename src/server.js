import http from "http";
import express from "express";
import path from "path";
import { Server } from "socket.io";
//IO 백설치
const __dirname = path.resolve();

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/src/public/views");
// 기본적으로 접근하는 디렉토리 설정
app.use("/public", express.static(__dirname + "/src/public"));
//pug 에서 script 접근할때 static 설정을 함

app.get("/", (_, res) => res.render("home"));
// 주소가 "/" 일떄 기본디렉토리 + 인자 값을 랜더함 /src/public/views/home 을 랜더하는거지
app.get("/*", (_, res) => res.redirect("/"));

const handlelisten = () => console.log(`Listening on http://localhost:5000`);

const httpServer = http.createServer(app);

const wsServer = new Server(httpServer);

function countRoom(roomName) {
  return wsServer.sockets.adapter.rooms.get(roomName)?.size;
}

function publicRooms() {
  const {
    sockets: {
      adapter: { sids, rooms },
    },
  } = wsServer;
  const publicRooms = [];
  rooms.forEach((_, key) => {
    if (sids.get(key) === undefined) {
      publicRooms.push(key);
    }
  });
  return publicRooms;
}
//public 방을 찾기 위해 개인방이 포함된 방리스트에서 소캣 아이디를 가진 개인 방을 뺌
const sockets = [];

wsServer.on("connection", (socket) => {
  wsServer.sockets.emit("room_change", publicRooms());
  socket["nickname"] = "Anon";
  socket.on("enter_room", (roomName, done) => {
    socket.join(roomName);
    // console.log(socket.rooms);
    //기본적으로 소캣은 id 명의 private 방에 혼자 있으며 방을 생성할 수 있음.
    done();

    socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));
    // 나를 제외한 모두에게 welcome을 실행함. 방인원수 본인한테는 안보임;;
    wsServer.sockets.emit("room_change", publicRooms());
    //방 리스트 확인
    socket.on("disconnecting", () => {
      socket.rooms.forEach((room) =>
        socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1)
      );
    });
    socket.on("disconnect", () => {
      wsServer.sockets.emit("room_change", publicRooms());
    });
    socket.on("new_message", (msg, room, done) => {
      socket.to(room).emit("new_message", `${socket.nickname}:${msg}`);
      done();
    });
    socket.on("nickname", (nickname) => (socket["nickname"] = nickname));
  });
  // console.log(socket);
});

httpServer.listen(5000, handlelisten);
