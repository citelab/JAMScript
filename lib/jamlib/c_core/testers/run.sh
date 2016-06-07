#! /bin/bash

./C2J_async_test &
sleep(2)
killall C2J_async_test
