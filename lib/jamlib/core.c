/*
The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:
The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

#include <assert.h>
#include <stdlib.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <dirent.h>

#include "core.h"
#include "mqtt.h"
#include "command.h"
#include "comboptr.h"
#include "uuid4.h"
#include "MQTTAsync.h"


void core_setup(corestate_t *cs)
{

    DIR *dir = opendir("./device.conf");
    if (dir == NULL)
    {
        printf("ERROR! Missing ./device.conf folder.\n");
        printf("Start the J node first and then the C node\n");
        printf("Start the C node from the same directory as the J node.\n");
        exit(1);
    }
    else
    {
        char fname[64];
        sprintf(fname, "./device.conf/cdeviceId.%d", cs->serial_num);
        if (access(fname, F_OK) != -1)
        {
            char devid[UUID4_LEN+1];
            // Get the device ID from the file... check for consistency..
            FILE *fp = fopen(fname, "r");
            if (fp == NULL)
            {
                printf("ERROR! Opening the file %s\n", fname);
                printf("Start the J node first and then the C node\n");
                exit(1);
            }
            if (fscanf(fp, "%s", devid) != 1)
            {
                printf("ERROR! Malformed device ID found in the configuration file\n");
                printf("Configuration file at %s is corrupted\n", fname);
                exit(1);
            }

            cs->device_id = strdup(devid);
        }
        else
        {
            // Create the deviceId and store it..
            char buf[UUID4_LEN];
            uuid4_generate(buf);
            cs->device_id = strdup(buf);

            // Save it under fname..
            FILE *fp = fopen(fname, "w");
            if (fp == NULL)
            {
                printf("ERROR! Unknown permission issue in opening the file %s\n", fname);
                printf("Exiting.\n");
                exit(1);
            }
            fprintf(fp, "%s", cs->device_id);
            fclose(fp);
        }
    }
}


// The core_init() is the bootstrapping function for JAMlib. It runs the MQTT client
// in asynchronous mode - it uses a slightly restricted callback to listen to a subset
// of messages. The restriction is lifted after the core_init() phase is over.
//

corestate_t *core_init(int port, int serialnum)
{
    #ifdef DEBUG_LVL1
        printf("Core initialization...");
    #endif

    // create the core state structure..
    corestate_t *cs = (corestate_t *)calloc(1, sizeof(corestate_t));
    // device_id set inside the following function
    cs->port = port;
    cs->cf_pending = true;
    cs->serial_num = serialnum;

    core_setup(cs);
    return cs;
}


void core_createserver(corestate_t *cs, int indx, char *url)
{
    cs->mqtthost[indx] = strdup(url);

    // open an mqtt connection to localhost
    cs->mqttserv[indx] = mqtt_create(cs->mqtthost[indx]);

    if (cs->mqttserv[indx] == NULL)
    {
        printf("WARNING! Cannot create MQTT endpoint at %s\n", url);
        printf("Could be an error in the endpoint discovered or configured at %s.\n", cs->mqtthost[0]);
    }

    cs->mqttenabled[indx] = false;
}


void core_connect(corestate_t *cs, int indx, void (*onconnect)(void *, MQTTAsync_successData *))
{
    int rc;

    MQTTAsync_connectOptions conn_opts = MQTTAsync_connectOptions_initializer;
    conn_opts.keepAliveInterval = 20;
    conn_opts.cleansession = 1;
    conn_opts.onSuccess = onconnect;
    conn_opts.context = cs;
    conn_opts.onFailure = NULL;

    rc = MQTTAsync_connect(cs->mqttserv[indx], &conn_opts);

    if ((rc != MQTTASYNC_SUCCESS) && (indx == 0))
    {
        printf("\nERROR! Unable to connect to the MQTT server at [%s].\n", cs->mqtthost[0]);
        printf("** Check whether an MQTT server is running at [%s] **\n\n", cs->mqtthost[0]);
        exit(1);
    }
    else if ((rc != MQTTASYNC_SUCCESS) && (indx != 0))
    {
        printf("\nWARNING! Unable to reconnect to the MQTT server at [%s].\n", cs->mqtthost[indx]);
        printf("** Check whether an MQTT server is running at [%s] **\n\n", cs->mqtthost[indx]);
        printf("Device could have moved away from the fog connection zone.\n");
    }

    printf("Core.. connected... %s\n", cs->mqtthost[indx]);
    cs->mqttenabled[indx] = true;
}


void core_setcallbacks(corestate_t *cs, comboptr_t *ctx,
        MQTTAsync_connectionLost *cl,
        MQTTAsync_messageArrived *ma,
        MQTTAsync_deliveryComplete *dc)
{
    MQTTAsync_setCallbacks(cs->mqttserv[ctx->iarg], ctx, cl, ma, dc);
}



void core_set_subscription(corestate_t *cs, int level)
{
    if (!cs->mqttenabled[level])
        return;

    mqtt_subscribe(cs->mqttserv[level], "/admin/announce/all");
    mqtt_subscribe(cs->mqttserv[level], "/level/func/reply/#");
    mqtt_subscribe(cs->mqttserv[level], "/mach/func/request");
            // Subscribe to the "go" topic for sync purpose.
    mqtt_subscribe(cs->mqttserv[level], "admin/request/Go");
}


void core_check_pending(corestate_t *cs)
{
    bool flag = false;
    for (int i = 0; i < 3; i++)
        if (!cs->mqttenabled[i])
            flag = true;

    cs->cf_pending = flag;
}
