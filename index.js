/*
Marco Martinez - markwinap@gmail.com
*/

//CONSOLE COLORS
const colors = require('colors');
//EXPRESS HTTP SERVER
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
//FILE SYSTEM READ WRITE FILES
const fs = require('fs');
//UPP
const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const status = dgram.createSocket('udp4');
//EXPRESS HTTP
const server_port = 3000;//Express HTTP Server PORT
//UDP PORTS
const port = 8889;//TELLO PORT
const port_status = 8890;//TELLO STATUS PORT
const drone_dist = 20;//DRONE DISTANCE
const throw_force = 50;//DRON THROW TAKEOFF Z FORCE
//GAMEPAD
const tello_default = '192.168.10.1';
const WebSocket = require('ws');//WEBSOCKET
const port_websocket = 8080;//WEBSOCKET PORT
const deathZone = 0.099;//FILTER FOR AXIS
const controllerType = 'xbox_1';//Select Your Cntroller
let temp_input = '';

const controller = {//Controller mapping a: left-right, b: forward-backward, c: up-down, d: yaw
    xbox_1 : {
        axis: {//rc a b c d
            0: {d: 1},// - 1 to invert result
            1: {c: -1},
            2: {a: 1},//
            3: {b: -1}
        },
        button: {
            0: 'flip b',
            1: 'flip r',
            2: 'flip l',
            3: 'flip f',
            4: 'land',
            5: 'takeoff',
            6: 'emergency',
            7: 'emergency',
            8: 'command',
            9: 'command',
            10: 'emergency',
            11: 'emergency',
            12: 'flip f',
            13: 'flip b',
            14: 'flip l',
            15: 'flip r',
            16: 'emergency'
        }
    },
    ps4 : {
        axis: {
            0: {d: 1},// - 1 to invert result
            1: {c: -1},
            2: {a: 1},
            3: {b: -1}
        },
        button: {
            0: 'flip b',
            1: 'flip r',
            2: 'flip l',
            3: 'flip f',
            4: 'land',
            5: 'takeoff',
            6: 'emergency',
            7: 'emergency',
            8: 'command',
            9: 'command',
            10: 'emergency',
            11: 'emergency',
            12: 'flip f',
            13: 'flip b',
            14: 'flip l',
            15: 'flip r',
            16: 'emergency',
            17: 'emergency'
        }
    }
};

//OTHER
const frame_rate = 60;//ANIMATION FRAME RATE
let commands = {};//OBJECT STATS AND COMMANDS HOLDER
const jsonParser = bodyParser.json();
//CONSOLE WELCOME
fs.readFile('banner/_2', 'utf8', function(err, banner) {
  console.log(banner.cyan);
  console.log('1 - RUN THIS SCRIPT'.white);
  console.log('2 - OPEN THE FOLLOWING URL NN YOUR INTERNET BROWSER'.white);
  console.log(`http://localhost:${server_port}/\n`.inverse);
  console.log('3 - CONNECT A GAMEPAD'.white);
  console.log('TO STOP THE SERVER USE'.white);
  console.log(`CTR+C\n`.inverse);
  console.log('HAVE FUN :P'.cyan);
});

//UDP CLIENT SERVER
server.on('error', (err) => {
  console.log(`server error:\n${err.stack}`);
  server.close();
});
server.on('message', (msg, rinfo) => {
  //UNCOMNET FOR DEBUG
  console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
  nextCMD(rinfo.address);//Check if commands available 
});
server.on('listening', () => {
  let address = server.address();
  //UNCOMNET FOR DEBUG
  //console.log(`UDP CMD RESPONSE SERVER - ${address.address}:${address.port}`);
});
server.bind(port);
//UDP STATUS SERVER
status.on('listening', function () {
    let address = status.address();
    //UNCOMNET FOR DEBUG
    //console.log(`UDP STATUS SERVER - ${address.address}:${address.port}`);
});
status.on('message', function (message, remote) {
    //UNCOMNET FOR DEBUG
    //console.log(`${remote.address}:${remote.port} - ${message}`);
    let msg_obj = dataSplit(message.toString());
    if(commands.hasOwnProperty(remote.address)){
      commands[remote.address]['status'] = msg_obj;
    }
    else{
      commands = Object.assign(commands, {[remote.address]: { status: msg_obj }})
    }
});
status.bind(port_status);


//EXPRESS SERVER
app.use('/', express.static('public'));
app.get('/test', function (req, res) {
  res.send('Hello World');
});

//GET REQUEST
app.get('/getKeys', function (req, res) {
  fs.readFile('keys.json', 'utf8', (err, file) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.error('myfile does not exist');
        return;
      }
      throw err;
    }
    let obj = JSON.parse(file);
    res.send(JSON.stringify(obj.A));
  });
});
//CHANGE PRESET
app.post('/changePreset', jsonParser, function (req, res) {//GET STATUS FROM DRONE
  fs.readFile('keys.json', 'utf8', (err, file) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.error('myfile does not exist');
        return;
      }
      throw err;
    }
    let obj = JSON.parse(file);
    res.send(JSON.stringify(obj[req.body.preset]));
  });
});
//ADD NEW KEY
app.post('/addKeys', jsonParser, function (req, res) {
  fs.readFile('keys.json', 'utf8', (err, keys) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.error('myfile does not exist');
        return;
      }
      throw err;
    }
    else{
      let file = JSON.parse(keys);
      let keysObj = file[req.body.preset];
      let drone = req.body.drone;
      keysObj.command_values[drone].push(req.body);
      for(let m in keysObj.command_values[drone]){
        if(m != 0){
          keysObj.command_values[drone][m] = getCommandVal(keysObj.command_values[drone][m - 1], keysObj.command_values[drone][m]);
        }        
      }
      keysObj.drone_commands[drone].push(getCommand(req.body));
      keysObj.drone_keys[drone] = getFrames(keysObj.drone_keys[drone], req.body, drone);
      //JSON UPDATE & RESPONSE
      file[req.body.preset] = keysObj;
      let KeysJSON = JSON.stringify(file);
      fs.writeFile('keys.json', KeysJSON, (err) => {
        if (err) throw err;
        else{
          res.send(JSON.stringify(file[req.body.preset]));
        }
      });
    }
  });
});
//UPDATE KEYS
app.post('/updateKeys', jsonParser, function (req, res) {
  fs.readFile('keys.json', 'utf8', (err, keys) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.error('myfile does not exist');
        return;
      }
      throw err;
    }
    else{
      let file = JSON.parse(keys);
      let keysObj = file[req.body.preset];
      let drone = req.body.drone;
      let frame = req.body.frame;
      let address = req.body.address;
      keysObj.command_values[drone][frame] = req.body
      for(let m in keysObj.command_values[drone]){
        if(m != 0){
          keysObj.command_values[drone][m] = getCommandVal(keysObj.command_values[drone][m - 1], keysObj.command_values[drone][m]);
        }        
      }
      keysObj.drone_commands[drone][frame] = getCommand(req.body);  
      keysObj.drone_address[drone] = address;
      keysObj.drone_keys[drone] = {
        position: {type: 'position',ani_type: 'ANIMATIONTYPE_VECTOR3',ani_mode: 'ANIMATIONLOOPMODE_CYCLE',keys: []},
        rotation_x: {type: 'rotation.x',ani_type: 'ANIMATIONTYPE_FLOAT',ani_mode: 'ANIMATIONLOOPMODE_CYCLE',keys: []},
        rotation_y: {type: 'rotation.y',ani_type: 'ANIMATIONTYPE_FLOAT',ani_mode: 'ANIMATIONLOOPMODE_CYCLE',keys: []},
        rotation_z: {type: 'rotation.z',ani_type: 'ANIMATIONTYPE_FLOAT',ani_mode: 'ANIMATIONLOOPMODE_CYCLE',keys: []}
      };
      for(let n in keysObj.command_values[drone]){
        keysObj.drone_keys[drone] = getFrames(keysObj.drone_keys[drone], keysObj.command_values[drone][n], drone);// PENDING
      }
      //JSON UPDATE & RESPONSE
      file[req.body.preset] = keysObj;
      let KeysJSON = JSON.stringify(file);
      fs.writeFile('keys.json', KeysJSON, (err) => {
        if (err) throw err;
        else{
          res.send(JSON.stringify(file[req.body.preset]));
        }
      });
    }
  });
});
//DELETE KEYS
app.post('/deleteKeys', jsonParser, function (req, res) {
  fs.readFile('keys.json', 'utf8', (err, keys) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.error('myfile does not exist');
        return;
      }
      throw err;
    }
    else{
      let file = JSON.parse(keys);
      let keysObj = file[req.body.preset];
      let drone = req.body.drone;
      let frame = req.body.frame;

      keysObj.command_values[drone].splice(frame, 1);
      for(let m in keysObj.command_values[drone]){
        if(m != 0){
          keysObj.command_values[drone][m] = getCommandVal(keysObj.command_values[drone][m - 1], keysObj.command_values[drone][m]);
        }        
      }
      keysObj.drone_commands[drone].splice(frame, 1);
      keysObj.drone_keys[drone] = {
        position: {type: 'position',ani_type: 'ANIMATIONTYPE_VECTOR3',ani_mode: 'ANIMATIONLOOPMODE_CYCLE',keys: []},
        rotation_x: {type: 'rotation.x',ani_type: 'ANIMATIONTYPE_FLOAT',ani_mode: 'ANIMATIONLOOPMODE_CYCLE',keys: []},
        rotation_y: {type: 'rotation.y',ani_type: 'ANIMATIONTYPE_FLOAT',ani_mode: 'ANIMATIONLOOPMODE_CYCLE',keys: []},
        rotation_z: {type: 'rotation.z',ani_type: 'ANIMATIONTYPE_FLOAT',ani_mode: 'ANIMATIONLOOPMODE_CYCLE',keys: []}
      };
      for(let n in keysObj.command_values[drone]){
        keysObj.drone_keys[drone] = getFrames(keysObj.drone_keys[drone], keysObj.command_values[drone][n], drone);// PENDING
      }
      //JSON UPDATE & RESPONSE
      file[req.body.preset] = keysObj;
      let KeysJSON = JSON.stringify(file);
      fs.writeFile('keys.json', KeysJSON, (err) => {
        if (err) throw err;
        else{
          res.send(JSON.stringify(file[req.body.preset]));
        }
      });
    }
  });
});
//ADD DRONE
app.post('/addDronne', jsonParser, function (req, res) {
  fs.readFile('keys.json', 'utf8', (err, keys) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.error('myfile does not exist');
        return;
      }
      throw err;
    }
    else{
      let file = JSON.parse(keys);
      let keysObj = file[req.body.preset];
      let drone = req.body.drone;
      keysObj.drone_keys.push(keysObj.drone_keys[drone]);
      keysObj.command_values.push(keysObj.command_values[drone]);
      keysObj.drone_commands.push(keysObj.drone_commands[drone]);
      keysObj.drone_address.push(keysObj.drone_address[drone]);

      console.log(drone)
      for(let i in keysObj.drone_keys){
        keysObj.drone_keys[i] = {
          position: {type: 'position',ani_type: 'ANIMATIONTYPE_VECTOR3',ani_mode: 'ANIMATIONLOOPMODE_CYCLE',keys: []},
          rotation_x: {type: 'rotation.x',ani_type: 'ANIMATIONTYPE_FLOAT',ani_mode: 'ANIMATIONLOOPMODE_CYCLE',keys: []},
          rotation_y: {type: 'rotation.y',ani_type: 'ANIMATIONTYPE_FLOAT',ani_mode: 'ANIMATIONLOOPMODE_CYCLE',keys: []},
          rotation_z: {type: 'rotation.z',ani_type: 'ANIMATIONTYPE_FLOAT',ani_mode: 'ANIMATIONLOOPMODE_CYCLE',keys: []}
        };
      }
      for(let j in keysObj.command_values){
        for(let n in keysObj.command_values[j]){
          keysObj.drone_keys[j] = getFrames(keysObj.drone_keys[j], keysObj.command_values[j][n], j);// PENDING
        }
      }


      //JSON UPDATE & RESPONSE
      file[req.body.preset] = keysObj;
      let KeysJSON = JSON.stringify(file);
      fs.writeFile('keys.json', KeysJSON, (err) => {
        if (err) throw err;
        else{
          res.send(JSON.stringify(file[req.body.preset]));
        }
      });
    }
  });
});
//REMOVE DRONE
app.post('/removeDronne', jsonParser, function (req, res) {
  fs.readFile('keys.json', 'utf8', (err, keys) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.error('myfile does not exist');
        return;
      }
      throw err;
    }
    else{
      let file = JSON.parse(keys);
      let keysObj = file[req.body.preset];
      let drone = req.body.drone;
      keysObj.drone_keys.splice(drone, 1);
      keysObj.command_values.splice(drone, 1);
      keysObj.drone_commands.splice(drone, 1);
      keysObj.drone_address.splice(drone, 1);
      
      //JSON UPDATE & RESPONSE
      file[req.body.preset] = keysObj;
      let KeysJSON = JSON.stringify(file);
      fs.writeFile('keys.json', KeysJSON, (err) => {
        if (err) throw err;
        else{
          res.send(JSON.stringify(file[req.body.preset]));
        }
      });
    }
  });
});
app.post('/sendCommands', jsonParser, function (req, res) {// SEND COMMANDS TO DRONE
  commands = null;
  commands = req.body;
  startCMD();
  res.send(commands);
});
app.post('/getStatus', jsonParser, function (req, res) {//GET STATUS FROM DRONE
  if(commands.hasOwnProperty(req.body.drone)){
    res.send(commands[req.body.drone].status);
  }
  else{
    res.send({Status: 'Offline'});
  }
  
});
app.get('/getAllStatus', function (req, res) {
  res.send(commands);
});

app.listen(server_port);//START EXPRESS SERVER


//ANNIMATION FUNCTIONS
function getCommand(values){
  let f = ['', 'l','r','f','b'];
  switch(values.command) {
      case 'up':
      case 'down':
      case 'left':
      case 'right':
      case 'forward':
      case 'back':
      case 'cw':
      case 'ccw':
      case 'level':
        return `${values.command} ${values.x}`;
        break;
      case 'flip':
          return `${values.command} ${f[values.x]}`;
          break;
      case 'go':
          return `${values.command} ${values.x} ${values.y} ${values.z} ${values.speed}`;
          break;
      case 'wait':
          return `${values.command} ${values.x}`;
          break;
      case 'curve':
          return `${values.command} ${values.x1} ${values.y1} ${values.z1} ${values.x2} ${values.y2} ${values.z2} ${values.speed}`;
          break;
      default:
          return values.command;//emergency
  }
}
function getFrames(keys, values, drone){//SET ANIMATION FRAMES
/*
x, y, z
x:Left/Rigth, y: Up/Down z: Forward/Backward - 3D
x:Forward/Backward y: Rigth/Left, z: Up/Down - DRONE
rotation x FRONT
    + CW 
    - CCW

rotation y TOP
    + CW 
    - CCW

rotation z SIDE
    + CW 
    - CCW

AnglePos - // L R|-X X, F B | -X X, ANGLE - RET {x, y}
*/

  if(keys.position.keys.length == 0){//BASIC FRAME AKA STARTING FRAME
    keys.position.keys.push({frame: 0,value: {x: (drone * drone_dist),y: 0,z: 0}});
    keys.rotation_x.keys.push({frame: 0,value: -1.570795});
    keys.rotation_y.keys.push({frame: 0,value: 0});
    keys.rotation_z.keys.push({frame: 0,value: 0});
    return keys;
  }
  
  let speed = 50;
  let old_position = keys.position.keys[keys.position.keys.length -1];
  let old_rotation_x = keys.rotation_x.keys[keys.rotation_x.keys.length -1];
  let old_rotation_y = keys.rotation_y.keys[keys.rotation_y.keys.length -1];
  let old_rotation_z = keys.rotation_z.keys[keys.rotation_z.keys.length -1];
  let new_position = {value: old_position.value};
  let new_rotation_x = {value: old_rotation_x.value};
  let new_rotation_y = {value: old_rotation_y.value};
  let new_rotation_z = {value: old_rotation_z.value};
  let new_frame = null;
  let dest = null;
  
  switch(values.command) {
      case 'command':
        new_position = {x: old_position.value.x, y: old_position.value.y, z: old_position.value.z};
        new_frame = old_position.frame + (frame_rate * getFrameDuration(speed, old_position.value, new_position));
        break;
      case 'up':
        new_position = {x: old_position.value.x, y: old_position.value.y + values.x, z: old_position.value.z};
        new_frame = old_position.frame + (frame_rate * getFrameDuration(speed, old_position.value, new_position));
        break;
      case 'takeoff':
        new_position = {x: old_position.value.x, y: getRandomInt(20) + 50, z: old_position.value.z};//TAKE OFF IS NOT ALWAYS PRECISE
        new_frame = old_position.frame + (frame_rate * getFrameDuration(speed, old_position.value, new_position));
        break;
      case 'level':
        new_position = {x: old_position.value.x, y: values.x, z: old_position.value.z};//GO TO X CM HEIGTH
        new_frame = old_position.frame + (frame_rate * getFrameDuration(speed, old_position.value, new_position));
        break;
      case 'emergency':
        new_position = {x: old_position.value.x, y: 0, z: old_position.value.z};
        new_frame = old_position.frame + (frame_rate * getFrameDuration(200, old_position.value, new_position));
        break;
      case 'land':
        new_position = {x: old_position.value.x, y: 0, z: old_position.value.z};
        new_frame = old_position.frame + (frame_rate * getFrameDuration(speed, old_position.value, new_position));
        break;
      case 'wait':
        new_position = {x: old_position.value.x, y: old_position.value.y, z: old_position.value.z};
        new_frame = old_position.frame + (frame_rate * parseInt(values.x, 0));
        break;
      case 'down':
        new_position = {x: old_position.value.x, y: old_position.value.y - values.x, z: old_position.value.z};
        new_frame = old_position.frame + (frame_rate * getFrameDuration(speed, old_position.value, new_position));
        break;
      case 'left':
        dest = getAnglePos((values.x * -1), 0, values.deg);
        new_position = {x: old_position.value.x + dest.x, y: old_position.value.y, z: old_position.value.z + (dest.y * -1)};
        new_frame = old_position.frame + (frame_rate * getFrameDuration(speed, old_position.value, new_position));
        break;
      case 'right':
        dest = getAnglePos(values.x, 0, values.deg);
        new_position = {x: old_position.value.x + dest.x, y: old_position.value.y, z: old_position.value.z + (dest.y * -1)};
        new_frame = old_position.frame + (frame_rate * getFrameDuration(speed, old_position.value, new_position));
        break;
      case 'forward':
        dest = getAnglePos(0, (values.x * -1), values.deg);
        new_position = {x: old_position.value.x + dest.x, y: old_position.value.y, z: old_position.value.z + (dest.y * -1)};
        new_frame = old_position.frame + (frame_rate * getFrameDuration(speed, old_position.value, new_position));
        break;
      case 'back':
        dest = getAnglePos(0, values.x, values.deg);
        new_position = {x: old_position.value.x  + dest.x, y: old_position.value.y, z: old_position.value.z + (dest.y * -1)};
        new_frame = old_position.frame + (frame_rate * getFrameDuration(speed, old_position.value, new_position));
        break;
      case 'go':
        dest = getAnglePos(values.y, (values.x * -1), values.deg);
        new_position = {x: old_position.value.x + dest.x, y: old_position.value.y + minVal(values.z), z: old_position.value.z + (dest.y * -1)};
        new_frame = old_position.frame + (frame_rate * getFrameDuration(speed, old_position.value, new_position));
        break;
      case 'flip'://1 LEFT - 2 RIGTH  - 3 FORWARD - 4 BACKWARD
        let flip_mov = 20; 
        if(values.x == 1){
          console.log('LEFT')
          dest = getAnglePos((flip_mov * -1), 0, values.deg);
          new_position = {x: old_position.value.x + dest.x, y: old_position.value.y, z: old_position.value.z + (dest.y * -1)};
          new_rotation_x = {value: old_rotation_x.value + (360 * (Math.PI / 180))};
        }
        else if( values.x == 2){
          console.log('RIGTH')
          dest = getAnglePos(flip_mov, 0, values.deg);
          new_position = {x: old_position.value.x + dest.x, y: old_position.value.y, z: old_position.value.z + (dest.y * -1)};
          new_rotation_x = {value: old_rotation_x.value - (360* (Math.PI / 180))};
        }
        else if( values.x == 3){
          console.log('FORWARD')
          dest = getAnglePos(0, (flip_mov * -1), values.deg);
          new_position = {x: old_position.value.x + dest.x, y: old_position.value.y, z: old_position.value.z + (dest.y * -1)};
          new_rotation_x = {value: old_rotation_x.value + (360 * (Math.PI / 180))};
        }
        else if( values.x == 4){
          console.log('BACKWARD')
          dest = getAnglePos(0, flip_mov, values.deg);
          new_position = {x: old_position.value.x  + dest.x, y: old_position.value.y, z: old_position.value.z + (dest.y * -1)};
          new_rotation_x = {value: old_rotation_x.value - (360* (Math.PI / 180))};//FORWARD
        }
        //new_position = {x: old_position.value.x  + (drone * drone_dist) + dest.x, y: old_position.value.y, z: old_position.value.z + (dest.y * -1)};
        new_frame = old_position.frame + (frame_rate * getFrameDuration(200, old_position.value, new_position));
        break;
      case 'cw':
        new_position = {x: old_position.value.x, y: old_position.value.y, z: old_position.value.z};
        new_rotation_y = {value: old_rotation_y.value + (values.x * (Math.PI / 180))};
        new_frame = old_position.frame + (frame_rate * getFrameDuration(speed, old_position.value, new_position));
        break;
      case 'ccw':
        new_position = {x: old_position.value.x, y: old_position.value.y, z: old_position.value.z};
        new_rotation_y = {value: old_rotation_y.value - (values.x * (Math.PI / 180))};
        new_frame = old_position.frame + (frame_rate * getFrameDuration(speed, old_position.value, new_position));
        break;
      default://Wait
        console.log('ELSE')
  } 
  //PUSH KEYS
  keys.position.keys.push({frame: new_frame, value: new_position});
  keys.rotation_x.keys.push({frame: new_frame, value: new_rotation_x.value});
  keys.rotation_y.keys.push({frame: new_frame, value: new_rotation_y.value});
  keys.rotation_z.keys.push({frame: new_frame, value: new_rotation_z.value});
  return keys;
}
function getFrameDuration(speed, a, b){//CALCULATE NEXT FRAME DURATION BASED ON SPEED AND DISTANCE TRAVEL
  let max_travel = 0;
  let arr = Object.keys(b);
  for(let i in arr){
      let temp = Math.abs(b[arr[i]] - a[arr[i]]);
      if(temp > max_travel){
          max_travel = temp;
      }
  }
  let res = parseInt(max_travel / speed, 0);
  if(res > 1){
      return res;
  }
  else return 1;
}
//UDP FUNCTIONS
async function startCMD(){
  let arr = Object.keys(commands);
  for(let i in arr){
    await senCMD(arr[i], commands[arr[i]]['cmd_list'][0]).catch((e) => console.log(e)).then((res) => console.log(res));
  }
  return 'OK';
}

function dataSplit(str){//Create JSON OBJ from String  "key:value;"
  let data = {};
  let arrCMD = str.split(';');  
  for(let i in arrCMD){
    let tmp = arrCMD[i].split(':');
    if(tmp.length > 1){
      data[tmp[0]] = tmp[1];
    }
  }
  return data;
}
//SEND COMMANDS
function senCMD(tello, command) {//SEND COMMAND TO TELLO OR SPECIAL FUNCTIONS
  var cmd = command.split(' ');
  /*
  if (parseInt(command, 0)) {//WAIT TIMMER FUNCTION
    return new Promise((resolve, reject) => {
      setTimeout(function () {
        nextCMD(tello);
        resolve('OK');
      }, parseInt(command, 0) * 1000);
    });
  }
  */
  if(cmd[0] == 'wait'){
    return new Promise((resolve, reject) => {
      setTimeout(function () {
        nextCMD(tello);
        resolve('OK');
      }, parseInt(cmd[1], 0) * 1000);
    });
  }
  else if(cmd[0] == 'throw'){//DRONE RESPONDS WIRH ERROR - NOT SUPPORTED BY DRONE
    return new Promise((resolve, reject) => {
      let inter = setInterval(function(){
        if(commands[tello]['status']['agz'] > throw_force){
          let msg = Buffer.from('takeoff');
          server.send(msg, 0, msg.length, port, tello, function (err) {
            clearInterval(inter);
            if (err) {
              console.error(err);
              reject(`ERROR : ${command}`);
            } else{
              resolve('OK');
            }
          });
        }
      }, 10);
    });
  }
  else if(cmd[0] == 'level'){// SET DRONE TO DESIRE LEVEL, CHECK CURRENT HEIGHT ANS SEND COMMAND TO MACH
    return new Promise((resolve, reject) => {
      let msg = null;
      let level = parseInt(cmd[1], 0);
      let h =  parseInt(commands[tello]['status']['h'], 0);
      if(h < level){
        msg = Buffer.from(`up ${level - h}`);
        console.log(`up ${level - h}`)
      }
      else if(h > level){
        msg = Buffer.from(`down ${h - level}`);
        console.log(`down ${h - level}`)
      }
      else{
        msg = Buffer.from('command');//DOMMY COMMAND
      }      
      server.send(msg, 0, msg.length, port, tello, function (err) {
        if (err) {
          console.error(err);
          reject(`ERROR : ${command}`);
        } else resolve('OK');
      });
    });
  }
  else if(cmd[0] == 'close'){//CLOSE UDP CONNECTION
    return new Promise((resolve, reject) => {
      server.close();
      server.unref();
      resolve('OK');
    });
  }
  else{//DEFAULT - SEND COMMAND TO TELLO DRONE
    return new Promise((resolve, reject) => {
      let msg = Buffer.from(command);
      server.send(msg, 0, msg.length, port, tello, function (err) {
        if (err) {
          console.error(err);
          reject(`ERROR : ${command}`);
        } else resolve('OK');
      });
    });
  }
}
function nextCMD(tello) {//GET NEXT COMMAND IN LINE
  if (commands.hasOwnProperty(tello)) {
    if(commands[tello].hasOwnProperty('cmd_list')){
      let cmd = commands[tello]['cmd_list'];
      if (cmd.length > 1) {
        cmd.shift();
        senCMD(tello, commands[tello]['cmd_list'][0]);
      } else {
        console.log('ALL CMD SENT');
      }
    }
    else{
      console.log('ALL CMD SENT');
    }

  } else {
    console.log('Drone Not Found');
  }
}
function minVal(val){
  if(val > 20 || val < -20){
    return val;
  }
  else return 0;
}
function sleep(ms){
  return new Promise(resolve=>{
      setTimeout(resolve,ms)
  })
}

//NEW
function getAnglePos(a, b, ang){
  //x = a cos(rad) - b sin(rad)
  //y = b cos(rad) + a sin(rad)
  let rad = ang * (Math.PI / 180);
  let x = (a * Math.cos(rad)) - (b * Math.sin(rad));
  let y = (b * Math.cos(rad)) + (a * Math.sin(rad));
  return {x: x, y: y}
}
function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}
function getCommandVal(a, b){  
  if(b.command == 'cw'){
    b.deg = getCW(a.deg, b.x);
  }
  else if(b.command == 'ccw'){
    b.deg = getCCW(a.deg, b.x);
  }
  else{
    b.deg = a.deg;
  }
  //console.log(`${a.deg} - ${b.deg}`)
  return b;
}
function getCW(a, b){
  let res = a == 360 ? 0 : a;
  for(let i = 0; i < b; i++){
    res++;
    if(res == 360){
      res = 0;
    }
  }
  return res;
}
function getCCW(a, b){
  let res = a == 0 ? 360 : a;
  for(let i = 0; i < b; i++){
    res--;
    if(res == 0){
      res = 360;
    }
  }
  return res;
}

//###WEBSOCKET### SERVER GAMEPAD
let websocket = new WebSocket.Server({ port: port_websocket });
websocket.on('connection', function connection(websocket) {
    console.log('Socket connected. sending data...');
    websocket.on('error', function error(error) {
        console.log('WebSocket error');
    });
    websocket.on('message', function incoming(msg) {
        let obj = JSON.parse(msg);
        let cmd;        
        cmd = getButton(obj.buttons) ? getButton(obj.buttons) : getAxes(obj.axes);
        if(cmd != temp_input){
            temp_input = cmd;
            //websocket.send(cmd);
            sendCMD(cmd);
        }       
    });
    websocket.on('close', function close(msg) {
        console.log('WebSocket close');
    });
});
function getButton(arr){//GAMEPAD Get Button Press
    let button = null;
    for(let i in arr){
        if(arr[i]) button = i;
    }
    return controller[controllerType].button[button];
}
function getAxes(arr){//GAMEPAD Get AXES Value (-100 - 100)
    let obj = {a: 0, b: 0, c: 0, d: 0};
    for(let i in arr){
        let key = Object.keys(controller[controllerType].axis[i]);//{d: 1}
        let val = 0;
        if(arr[i] < deathZone && arr[i] > (deathZone * -1)){
            val = 0;
        }
        else{
            val = arr[i];
        }
        obj[key] = parseInt((val * 100) * controller[controllerType].axis[i][key], 0);
    }
    return `rc ${obj.a} ${obj.b} ${obj.c} ${obj.d}`;    
}
function sendCMD(command){//GAMEPAD Send CMD To Drone
  return new Promise((resolve, reject) => {
      let msg = Buffer.from(command);
      server.send(msg, 0, msg.length, port, tello_default, function (err) {
        if (err) {
          console.error(err);
          reject(`ERROR : ${command}`);
        } else resolve('OK');
      });
    });
}