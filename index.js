const WebSocket = require('ws');
const fs = require('fs');
const server = new WebSocket.Server({ host: 'localhost', port: 8080 });
console.log("Server listening on port 8080");
let users = [];
try {
  const usersData = fs.readFileSync('users.json', 'utf-8');
  users = JSON.parse(usersData);
} catch (error) {
  console.error('Error loading users:', error);
}


function deleteClientFromSet(key, client) {
  if (clientsMap.has(key)) {
    const clientsSet = clientsMap.get(key);
    clientsSet.delete(client);
    if (clientsSet.size === 0) {
      clientsMap.delete(key);
    } else {
      clientsMap.set(key, clientsSet);
    }
  }
}

const clientsMap = new Map();
const clients = new Set();
var clientu = new Set();
function logClientsMap() {
  console.log('Clients Map Entries:');
  clientsMap.forEach((clientsSet, roomId) => {
    console.log(`Room ID: ${roomId}`);
    clientsSet.forEach((client) => {
      console.log(`  Client ID: ${client.clientId}`);
    });
  });
}
function addClientToSet(key, client) {
  if (clientsMap.has(key)) {
    const clientsSet = clientsMap.get(key);

    // Check if the client is already in the set
    const existingClient = Array.from(clientsSet).find((existingClient) => existingClient.clientId === client.clientId);

    if (existingClient) {
      // Replace the existing client with the new one
      clientsSet.delete(existingClient);
    }

    // Add the new client to the set
    clientsSet.add(client);
    clientsMap.set(key, clientsSet);
  } else {
    const newClientsSet = new Set([client]);
    clientsMap.set(key, newClientsSet);
  }
}



server.on('connection', (socket, request) => {
  console.log("Connected");
  const urlParams = new URLSearchParams(request.url.slice(1));
  const username = urlParams.get('username');
  const password = urlParams.get('password');
  const profilepic = urlParams.get('profilepic');
  const hostRoomIds = urlParams.get('host_roomids');
  const roomIds = urlParams.get('roomids');
  const roomid = urlParams.get('roomid');
  const action = urlParams.get('action');
  
  
  if (!username) {
    console.error('Error: Username not provided during connection.');
    socket.send(JSON.stringify("1"));      // USERNAME NOT PASSED TO SERVER
    socket.close();
    return;
  }
  else if(!roomid)
  {
    const usersJson = fs.readFileSync('users.json', 'utf-8');
    try {
      const usersArray = JSON.parse(usersJson);
      const userWithMatchingCredentials = usersArray.find(user => 
        user.username === username && user.password === password
      );
      const userWithMatchingname = usersArray.find(user => 
        user.username === username && user.password !== password
      );
      if (userWithMatchingCredentials) {
        console.log(0);
        socket.send(JSON.stringify("0")); // USER FOUND
      } else if(userWithMatchingname){
        console.log(2);      
        socket.send(JSON.stringify("2"));  // USERNAME FOUND PASSWORD MISMATCH
      }
      else
      {
        console.log(3);
        socket.send(JSON.stringify("3"));  // USERNAME DOES NOT EXIST
        if(action &&action === '1')   // ACTION 1 MEANS REGISTRATION
        {
          const userObject = {
            username,
            password: password || '',
            profilepic: profilepic || '',
            Host_roomids: hostRoomIds || '',
            roomids: roomIds || '',
          };
          users.push(userObject);
          fs.writeFileSync('users.json', JSON.stringify(users, null, 4));
        }
      }
    } catch (error) {
      console.error('Error parsing users.json:', error.message);
    }
    socket.close();
    return;
  }
  if(action=== '2')    // ACTION 2 CHECK IF ROOMID EXISTS
  {
    console.log("in action");
     if (clientsMap.has(roomid)) {
      socket.send(JSON.stringify('1'));
      console.log(1);
     }
     else
     {
     socket.send(JSON.stringify('0'));
     console.log(1);
     }
     socket.close();
     return;
  }

  console.log({ username });
  
  const clientObject = {
    socket,
    clientId: username,
  };
  addClientToSet(roomid, clientObject);
  clients.add(clientObject);
  const welcomeMessage = {
    type: 'welcome',
    content: `Welcome, ${username}! Your ID is ${username}`,
  };
  socket.send(JSON.stringify(welcomeMessage));
  broadcast({
    type: 'add',
    content: `${username} has joined`,
  },roomid);

  socket.on('message', (message) => {
    addClientToSet(roomid, clientObject);
    
    const messageText = message.toString('utf-8');
    console.log("Message :",messageText ," from ",username);
    logClientsMap();
    if (messageText.startsWith('@')) {
      logClientsMap();
      const spaceIndex = messageText.indexOf(' ');
      if (spaceIndex !== -1) {
        const targetUsername = messageText.substring(1, spaceIndex);
        const directMessage = messageText.substring(spaceIndex + 1);
        const senderUsername = username;

        clientsMap.get(roomid).forEach((client) => {
          if (client.clientId === targetUsername) {
            const directMessageObj = {
              type: 'directMessage',
              content: `${directMessage}`,
              username: `${senderUsername}`
            };
            console.log(JSON.stringify(directMessageObj));
            client.socket.send(JSON.stringify(directMessageObj));
            socket.send(JSON.stringify(directMessageObj));
            
          }
        });
      }
    } else {
      
      const broadcastMessage = {
        type: 'message',
        content: `${messageText}`,
        username: `${username}`
      };
      broadcast(broadcastMessage,roomid);
    }
  });

  socket.on('close', () => {
    clients.delete(clientObject);
    deleteClientFromSet(roomid,clientObject);
    const userIndex = users.indexOf(username);
    if (userIndex !== -1) {
      users.splice(userIndex, 1);
      fs.writeFileSync('users.json', JSON.stringify(users));
    }
    const leaveMessage = {
      type: 'left',
      content: `${username} has left`,
    };
    broadcast(leaveMessage,roomid);
  });
});

function broadcast(message , roomid) {
  if(clientsMap.has(roomid))
  {
  clientsMap.get(roomid).forEach((client) => {
    client.socket.send(JSON.stringify(message));
  });
}
}