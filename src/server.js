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

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.get("/", (_, res) => res.render("home"));
// 주소가 "/" 일떄 기본디렉토리 + 인자 값을 랜더함 /src/public/views/home 을 랜더하는거지
app.get("/*", (_, res) => res.redirect("/"));

const handlelisten = () => console.log(`Listening on http://localhost:4500`);

const httpServer = http.createServer(app);

const io = new Server(httpServer);

function countRoom(roomName) {
  return io.sockets.adapter.rooms.get(roomName)?.size;
}

function publicRooms() {
  const {
    sockets: {
      adapter: { sids, rooms },
    },
  } = io;
  const publicRooms = [];
  rooms.forEach((_, key) => {
    if (sids.get(key) === undefined) {
      publicRooms.push(key);
    }
  });
  return publicRooms;
}
//public 방을 찾기 위해 개인방이 포함된 방리스트에서 소캣 아이디를 가진 개인 방을 뺌

io.on("connection", (socket) => {
  socket.on("userid", (userid) => {
    socket["nickname"] = userid;
  });

  socket.on("join_room", (roomName) => {
    socket.join(roomName);
    socket.to(roomName).emit("welcome", socket["nickname"]);
  });

  socket.on("offer", async (offer, offerid, answerid) => {
    console.log("offer");
    const usersocket = Array.from(io.sockets.sockets.values()).find(
      (s) => s.nickname === answerid
    );
    if (usersocket) {
      usersocket.emit("offer", offer, offerid, answerid);
    } else {
      console.log("user is not exist");
    }
  });
  socket.on("answer", async (answer, offerid, answerid) => {
    console.log("answer");
    const usersocket = Array.from(io.sockets.sockets.values()).find(
      (s) => s.nickname === offerid
    );
    if (usersocket) {
      usersocket.emit("answer", answer, answerid);
    } else {
      console.log("user is not exist");
    }
  });

  socket.on("ice", (ice, targetid, roomName) => {
    if (ice) {
      socket.to(roomName).emit("ice", ice, targetid);
    }
  });

  socket.on("leave", (targetid, roomName) => {
    socket.to(roomName).emit("leave", targetid);
    socket.leave(roomName);
  });
  socket.on("test", () => {
    socket.emit("test");
  });
});

// const OfferMiddle = async (offer, offerid, answerid) => {
//   // console.log(numClients);
//   const usersocket = Array.from(io.sockets.sockets.values()).find(
//     (s) => s.nickname === answerid
//   );
//   if (usersocket) {
//     console.log(usersocket);
//     usersocket.emit("offer", offer, offerid, answerid);
//   } else {
//     console.log("user is not exist");
//   }
// };

// const AnswerMiddle = async (answer, offerid, answerid) => {
//   const usersocket = Array.from(io.sockets.sockets.values()).find(
//     (s) => s.nickname === offerid
//   );
//   if (usersocket) {
//     usersocket.emit("answer", answer, answerid);
//   } else {
//     console.log("user is not exist");
//   }
// };

// const IceMiddle = (ice, targetid) => {
//   if (ice) {
//     socket.to(roomName).emit("ice", ice, targetid);
//   }
// };

httpServer.listen(4500, handlelisten);
