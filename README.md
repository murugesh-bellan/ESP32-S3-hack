# ESP32-S3-hack

Reference:

https://gist.github.com/sam-tucker/81840112bb3747a2f641d248b08507b6

**TODO Items:**

1. Get familiar with the hardware so you can program ESP 32 from your laptop ("Hello World") - both boards : SJ, MB

2. Read IMU Data (Accelerometer) as that is what we will use to train for gesture detections to build a classifier (Still, Forehand, Backhand, Serve) - MB

  - BONUS: After classifying 'shot type', use raw IMU data (Accelerometer) to detect stregnth (fake speed to know how fast/slow was the swing) in percentage (accuracy of model classification) 

4. Train Tiny ML model for the above gestures (Impulse Edge platform or locally on your laptop) and deploy it on Arduino to test accuracy of it with cable and without. - MB

5. Show in UI & output in logs, later we will need to send it to the Game server using sockets - MB

6. Make a sound (beep or play voice sample) for each shot type that was detected as it was swung but no sound when it's STILL - MB

```sh
╭──────────────╮
│   FOREHAND   │
│              │
│   █████ 87%  │
│              │
│   62 km/h    │
╰──────────────╯
```

7. Game (Central Server that is talking to the arduino's over websocket): - SJ

  Game Scene: Three.JS (Court with proper lines, Net, Ball object, Raquets - mapped to arduino/s, Player avatar (bonus))

  Game Mechanics: 
  
   - Level 1: Practice against Wall : just hit the ball against a wall and it comes back to you and show countdown timer (default 30 seconds), hits and misses
   - Level 2: Play against Computer: Tennis Score against computer (Tennis Scoring with audio output)
   - Level 3: Play against each other (multiplayer, web sockets) : Same as above but with 2 players




