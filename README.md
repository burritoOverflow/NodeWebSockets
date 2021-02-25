For debugging:
with powershell, using the `debug` npm module (here with only socketio); use only a wildcard for all debugging (inc express, nodemon etc)

```
$env:DEBUG='$env:DEBUG='socket.io*';
```
