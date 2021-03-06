# DJI TELLO EXPERIMENTS - Twilio SMS Commands

### CLONE REPO
```sh
git clone https://github.com/markwinap/DJI-TELLO-EXPERIMENTS.git
```
### GO TO FOLDER
```sh
cd DJI-TELLO-EXPERIMENTS/TWILIO_SMS_COMMANDS/
```
### INSTALL
```sh
npm install
```
### START SERVER
```sh
node index
```

### START SERVER
```sh
node index
```

## UDP COMANDS SDK 1.3

| COMMAND | DEFINITION | NOTES | EXAMPLE | RESPONSE |
| ------ | ------ | ------ | ------ | ------ |
| command | Enable command mode | Required before sending drone commands | command | ok, error |
| takeoff | Start Drone motors and takeoff | Takeoff and go to ~60-90 cm height | takeoff | ok, error |
| land | Land the Drone and stop the motors | ~50cm/s land speed | land | ok, error |
| emergency | Stop motors | Use for emergency stop | emergency | ok, error |
| up x | Go up 20 - 500 | Centimeters - Imput lower than 20 will get ignored | up 10 | ok, error |
| down x | Go down 20 - 500 | Centimeters - Imput lower than 20 will get ignored | down 10 | ok, error |
| left x | Go left 20 - 500 | Centimeters - Imput lower than 20 will get ignored | left 10 | ok, error |
| right x | Go right 20 - 500 | Centimeters - Imput lower than 20 will get ignored | right 10 | ok, error |
| forward x | Go forward 20 - 500 | Centimeters - Imput lower than 20 will get ignored | forward 10 | ok, error |
| back x | Go backward 20 - 500 | Centimeters - Imput lower than 20 will gw 180 | ok, error |
| flip x | Flip drone to the left, right, forward or backward | Possible inputs (l, r, f b) | flip f | ok, error |
| go x y z speed | Go Forward or Backward, Left or Rigth, Up or Down  | X: -500 - 500, Y: -500 - 50et ignored | back 10 | ok, error |
| cw x | Rotate drone clockwise 1-360 | Degrees | Degrees | ccw 180 | ok, error |
| ccw x | Rotate drone counterclockwise 1-360 | Degrees | ccw 180 | ok, error |



## EXTRA Commands

| COMMAND | DEFINITION | NOTES | EXAMPLE | RESPONSE |
| ------ | ------ | ------ | ------ | ------ |
| wait x | Wait for x seconds | - | wait 3 | ok, error |
| level x | Level drone to x centimeters | - | level 200 | ok, error |