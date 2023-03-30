
from ucallback...

    //printf("Reply received : %lld, count %d\n", reply->integer, count);
    if (count > 1000000)
        exit(0);

    for (int i = 0; i < 2; i++) {
        char temp[64];
        int i = count++;
        snprintf(temp, 64, "set key-%d value-%d", i, i);
        redisAsyncCommand(dp->uctx, NULL, NULL, temp);
    }
//    for (int i = 0; i < 1000; i++) {
        char temp[64];
        int i = count++;
        snprintf(temp, 64, "set key-%d value-%d", i, i);
        redisAsyncCommand(dp->uctx, dpanel_ucallback, dp, temp);
  //  }
