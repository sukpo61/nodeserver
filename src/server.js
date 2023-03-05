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
  rooms.forEach((value, key) => {
    if (sids.get(key) !== undefined) {
      rooms.delete(key);
    }
  });
  return rooms;
}

function getChannelRooms(channelId) {
  const channelrooms = [];
  const Allrooms = io.sockets.adapter.rooms;

  function getUserInfo(value) {
    const userinfo = [];
    value.forEach((e) => {
      const usersocket = Array.from(io.sockets.sockets.values()).find(
        (s) => s.id === e
      );
      userinfo.push({
        userid: usersocket.nickname,
      });
    });
    return userinfo;
  }
  Allrooms.forEach((value, key) => {
    if (key.split("/")[0] === channelId && key.split("/")[1]) {
      channelrooms.push({
        name: key.split("/")[1],
        userinfo: getUserInfo(value),
        usercount: roomsData.get(key).usercount,
        password: roomsData.get(key).password,
      });
    }
  });
  return channelrooms;
}

function getChannelsockets(channelId) {
  const channelusers = [];
  const Allrooms = io.sockets.adapter.rooms;

  function getuserSockets(value) {
    const channel = [];
    value.map((e) => {
      const usersocket = Array.from(io.sockets.sockets.values()).find(
        (s) => s.id === e
      );
      channel.push(usersocket);
    });
    return channel;
  }

  Allrooms.forEach((room, key) => {
    if (key.split("/")[0] === channelId) {
      room.forEach((value) => {
        channelusers.push(value);
      });
    }
  });
  return getuserSockets(channelusers);
}

function getFriendChannel(userid) {
  let roomname = null;
  const usersocket = Array.from(io.sockets.sockets.values()).find(
    (s) => s.nickname === userid
  );
  if (usersocket) {
    publicRooms().forEach((room, roomId) => {
      room.forEach((value) => {
        if (usersocket?.id === value && roomId.split("/")[1]) {
          roomname = roomId;
        }
      });
    });
  }
  return roomname;
}

// room.forEach((value) => {
//   if (usersocket?.id === value && roomId.split("/")[1]) {
//     roomname = roomId;
//   }
// });

function getAllChannelInfo() {
  let channelsinfo = [];

  publicRooms().forEach((room, roomId) => {
    let roomchannelid = roomId.split("/")[0];
    if (roomId.split("/")[1]) {
      if (
        channelsinfo.map((e) => e.channelid).includes(roomchannelid) &&
        channelsinfo !== []
      ) {
        channelsinfo?.map((channelinfo, index) => {
          if ((channelinfo.channelid = roomchannelid)) {
            channelinfo.usercount = channelinfo.usercount + room.size;
            channelsinfo[index] = channelinfo;
          }
        });
      } else {
        channelsinfo = [
          ...channelsinfo,
          { channelid: roomchannelid, usercount: room.size },
        ];
      }
    }
  });
  return channelsinfo;
}

let roomsData = new Map();

//public 방을 찾기 위해 개인방이 포함된 방리스트에서d 소캣 아이디를 가진 개인 방을 뺌

io.on("connection", (socket) => {
  socket.on("userid", (userid) => {
    socket["nickname"] = userid;
  });

  socket.on("getactivechannels", () => {
    socket.emit("getactivechannels", getAllChannelInfo());
  });

  socket.on("requestrooms", (channelId) => {
    console.log("requestrooms", channelId);
    socket.join(`${channelId}/`);
    socket.emit("requestrooms", getChannelRooms(channelId));
  });

  socket.on("friendchannel", (userid) => {
    socket.emit("friendchannel", getFriendChannel(userid), userid);
  });

  socket.on("join_room", (roomdata, targetid) => {
    const roomname = `${roomdata.channelId}/${roomdata.roomtitle}`;
    roomsData.set(roomname, {
      usercount: roomdata.usercount,
      password: roomdata.password,
    });
    socket.join(roomname);
    const channelsockets = getChannelsockets(roomdata.channelId);
    channelsockets.map((usersocket) => {
      usersocket.emit(
        "updaterooms",
        getChannelRooms(roomdata.channelId, socket["nickname"])
      );
    });
    socket.to(roomname).emit("welcome", socket["nickname"]);

    socket.once("disconnect", () => {
      const room = io.sockets.adapter.rooms.get(roomname);
      console.log(roomname);
      socket.to(roomname).emit("leave", targetid);
      const channelsockets = getChannelsockets(roomdata.channelId);
      channelsockets.map((usersocket) => {
        usersocket.emit("updaterooms", getChannelRooms(roomdata.channelId));
      });
    });
  });

  socket.on("offer", async (offer, offerid, answerid) => {
    console.log("offerd");
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
    const usersocket = Array.from(io.sockets.sockets.values()).find(
      (s) => s.nickname === offerid
    );
    if (usersocket) {
      usersocket.emit("answer", answer, answerid);
    } else {
      console.log("user is not exist");
    }
  });

  socket.on("ice", (ice, targetid, roomdata) => {
    const roomname = `${roomdata.channelId}/${roomdata.roomtitle}`;
    if (ice) {
      socket.to(roomname).emit("ice", ice, targetid);
    }
  });

  socket.on("leave", (targetid, roomdata) => {
    const roomname = `${roomdata.channelId}/${roomdata.roomtitle}`;
    const room = io.sockets.adapter.rooms.get(roomname);
    // if (room.size === 1) {
    //   roomsData.delete(roomname);
    //   console.log(roomsData);
    // }
    socket.to(roomname).emit("leave", targetid);
    socket.leave(roomname);
    const channelsockets = getChannelsockets(roomdata.channelId);
    channelsockets.map((usersocket) => {
      usersocket.emit("updaterooms", getChannelRooms(roomdata.channelId));
    });
  });
  socket.on("channelleave", (channelId) => {
    console.log("channelleave", channelId);
    socket.leave(`${channelId}/`);
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
