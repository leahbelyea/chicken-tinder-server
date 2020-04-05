const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const uuid = require('uuid');
const axios = require('axios');
require('dotenv').config();

app.get('/', function(req, res) {
  res.status(200).send();
});

// Restaurants keyed by roomId
const roomRestaurants = {};
// Options keyed by roomId
const roomOptions = {};
// Selections keyed by socketId
const userSelections = {};
// Rooms keyed by socketId
const userRooms = {}

io.on('connection', socket => {
  socket.on('join', ({roomId, options}) => {
    if (!roomId) {
      // Setup new room
      const newRoomId = uuid.v4();
      socket.join(newRoomId);
      socket.emit('assignedRoom', newRoomId);
      userRooms[socket.id] = newRoomId;
      roomOptions[newRoomId] = options;

      // Get restaurant choices
      const { latitude, longitude, radius, categories, openNow } = options;
      const categoryString = categories.length === 0 ? 'restaurants' : categories.join(',');
      let url = `https://api.yelp.com/v3/businesses/search?latitude=${latitude}&longitude=${longitude}&radius=${radius}&categories=${categoryString}&limit=25`;
      if (openNow) {
        url = url + '&open_now=true'
      }
      axios.get(url,
        {
        headers: {
          Authorization: `Bearer ${process.env.YELP_API_KEY}`
        }
      })
      .then(function (response) {
        roomRestaurants[newRoomId] = response.data.businesses;
      })
      .catch(function (error) {
        console.log(error);
      });

    } else {
      // Join existing room
      io.in(roomId).clients((err , clients) => {
        if (err) {
          console.log(err);
        } else {
          // Allow only 2 people per room
          if (clients.length < 2) {
            socket.join(roomId);
            userRooms[socket.id] = roomId;
            io.to(roomId).emit('fetchedChoices', roomRestaurants[roomId]);
          }
        }
      });
    }
  });

  socket.on('choices', ({choices}) => {
    const roomId = userRooms[socket.id];
    const options = roomOptions[roomId];
    userSelections[socket.id] = choices;

    // check to see if both room occupants are done
    const roomSelections = [];
    io.in(roomId).clients((err , clients) => {
      if (err) {
        console.log(err);
      } else {
        clients.forEach(client => {
          const clientSelections = userSelections[client];
          if (clientSelections) {
            roomSelections.push(userSelections[client]);
          }
        });

        if (roomSelections.length === 2) {
          const matches = roomSelections[0].filter(restaurantId => {
            return roomSelections[1].indexOf(restaurantId) > -1;
          });

          if (options.pickRandom) {
            // get random match
            let randomMatch;
            if (matches.length > 0) {
              const randomMatchIndex = Math.floor(Math.random() * matches.length);
              const randomMatchId = matches[randomMatchIndex];
              randomMatch = roomRestaurants[roomId].filter(({id}) => { return id === randomMatchId});
            }
            io.to(roomId).emit('selectedMatches', randomMatch);
          } else {
            const matchList = roomRestaurants[roomId].filter(({id}) => { return matches.indexOf(id) > -1 });
            io.to(roomId).emit('selectedMatches', matchList);
          }
        }
      }
    });
  });

  socket.on('disconnect', () => {
    const roomId = userRooms[socket.id];
    delete userSelections[socket.id];
    delete userRooms[socket.id];
    io.in(roomId).clients((err , clients) => {
      if (err) {
        console.log(err);
      } else {
        if (clients.length === 0) {
          delete roomRestaurants[roomId];
          delete roomOptions[roomId];
        }
      }
    });
  });
});

http.listen(3001, function() {
  console.log('listening on *:3001');
});
