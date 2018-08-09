#!/usr/bin/env bash

if [ -z "$1" ]; then
  echo 'Error: program must be specified'
  exit 1
fi

app="${1##*/}"
app="${app%.*}"
config=($(node <<< 'var config = require("./config/default"); console.log(config.fogs, config.devices);'))

get_port() {
  python -c 'import socket; s = socket.socket(); s.bind(("", 0)); print(s.getsockname()[1]); s.close()'
}

# enable job control
set -m

# print the current time in milliseconds
node <<< 'console.log(Date.now());';

# start the cloud in the background
jamrun "$1" --app="$app" --data=127.0.0.1:$(get_port) --cloud &

# start the fogs in the background
for i in $(seq 1 ${config[0]}); do
  jamrun "$1" --app="$app" --data=127.0.0.1:$(get_port) --fog --bg >/dev/null 2>&1
done

# start the devices in the background
for i in $(seq 1 ${config[1]}); do
  jamrun "$1" --app="$app" --data=127.0.0.1:$(get_port) --bg >/dev/null 2>&1
done

# bring the cloud to the foreground
fg
