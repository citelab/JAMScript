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

#include "core.h"
#include "mqtt.h"
#include "uuid4.h"
#include "command.h"


// Returns the device ID string from the filepath.

char *get_device_id(char *filepath)
{
    char *devid = (char *)malloc(64);

    FILE *fp = fopen(filepath, "r");
    if (fp == NULL)
    {
        printf("ERROR! Missing: %s\n", filepath);
        printf("Start the J node first and then the C node\n");
        printf("If you are running JAMScript in a single machine, you need\n");
        printf("run a device in its own directory - i.e., C and J components\n");
        exit(1);
    }

    if (fscanf(fp, "%s", devid) != 1)
    {
        printf("ERROR! Malformed device ID found in the configuration file\n");
        printf("Configuration file at %s is corrupted\n", filepath);
        exit(1);
    }

    return devid;
}


// The core_init() is the bootstrapping function for JAMlib. It runs the MQTT client
// (Paho) library in single thread mode - synchronous send and receive. Later we switch
// it to multi-threaded mode.
//


corestate_t *core_init(int port, int timeout)
{
    command_t *scmd, *rcmd, *rcmd2;

    #ifdef DEBUG_LVL1
        printf("Core initialization...");
    #endif

    // create the core state structure..
    corestate_t *cs = (corestate_t *)calloc(1, sizeof(corestate_t));
    // device_id set inside the following function
    core_setup(cs, timeout);
    cs->mqtthost[0] = (char *)malloc(64);

    sprintf(cs->mqtthost[0], "tcp://localhost:%d", port);
    // open an mqtt connection to localhost
    cs->mqttserv[0] = mqtt_open(cs->mqtthost[0]);
    if (cs->mqttserv[0] == NULL)
    {
        printf("\nERROR! Unable to connect to the MQTT server at [%d].\n", port);
        printf("** Check whether an MQTT server is running at [%d] **\n\n", port);
        exit(1);
    }

    // send register message
    scmd = command_new("REGISTER", "DEVICE", "-", 0, "-", "-", cs->device_id, "");
    mqtt_publish(cs->mqttserv[0], "/admin/request/all", scmd);
    rcmd = mqtt_receive(cs->mqttserv[0], "REGISTER-ACK", "/admin/announce/all", cs->timeout);
    // if we did not get the reply.. wait for the PING from an active server node
    if (rcmd == NULL)
    {
        // wait with a large timeout.. about 1 hr.
        rcmd = mqtt_receive(cs->mqttserv[0], "PING", "/admin/announce/all", 1000 * 60 * 60);
        if (rcmd == NULL)
        {
            printf("ERROR! Connection cannot be established to the server (J). \nQuiting.\n\n");
            exit(1);
        }
        command_free(rcmd);
        // send register message
        scmd = command_new("REGISTER", "DEVICE", "-", 0, "-", "-", cs->device_id, "");
        mqtt_publish(cs->mqttserv[0], "/admin/request/all", scmd);
        rcmd = mqtt_receive(cs->mqttserv[0], "REGISTER-ACK", "/admin/announce/all", cs->timeout);

        // get the register acknowledge message
        if (rcmd == NULL)
        {
            // if the acknowledege timed out or registration failed.. report it.
            printf("\nQUITING. REGISTER failed. Service component (J) not running?? \n\n");
            exit(1);
        }
        command_free(rcmd);
    }
    else
        command_free(rcmd);

    // Only the local (device) J node is set here.
    // The local J-C binding is fairly stable..
    cs->mqttenabled[0] = true;

    // Next we look at other J nodes (fog, and cloud)
    // These associations are more volatile
    // We do the initial assocation here and recompute these associations later
    // in the asynchronous loop.

    cs->cf_pending = true;

    // get information about the machine state: fog address, cloud address
    scmd = command_new("GET-CF-INFO", "DEVICE", "-", 0, "-", "-", cs->device_id, "");
    mqtt_publish(cs->mqttserv[0], "/admin/request/all", scmd);

    rcmd = mqtt_receive(cs->mqttserv[0], "PUT-CF-INFO", "/admin/announce/all", cs->timeout);
    if (rcmd != NULL)
    {
        core_makeconnection(cs, rcmd);
        command_free(rcmd);

        // get the next information..
        rcmd = mqtt_receive(cs->mqttserv[0], "PUT-CF-INFO", "/admin/announce/all", cs->timeout);
        if (rcmd != NULL)
        {
            core_makeconnection(cs, rcmd);
            command_free(rcmd);
            cs->cf_pending = false;
        }
        else
            printf("\nWARNING! Cloud/Fog information pending... \n");
    }
    else
        printf("\nWARNING! Cloud/Fog information pending... \n");

    command_free(scmd);

    return cs;
}


void core_makeconnection(corestate_t *cs, command_t *cmd)
{
    command_t *scmd, *rcmd;
    int indx;

    if (strcmp(cmd->actarg, "fog") == 0)
        indx = 1;
    else if (strcmp(cmd->actarg, "cloud") ==0)
        indx = 2;
    else
        return;

    cs->mqttserv[indx] = mqtt_open(cmd->args[0].val.sval);
    if (cs->mqttserv[indx] != NULL)
    {
        scmd = command_new("REGISTER", "DEVICE", "-", 0, "-", "-", cs->device_id, "");
        mqtt_publish(cs->mqttserv[indx], "/admin/request/all", scmd);
        command_free(scmd);

        // get the register acknowledge message
        if ((rcmd = mqtt_receive(cs->mqttserv[indx], "REGISTER-ACK", "/admin/announce/all", cs->timeout)) == NULL)
            cs->mqttenabled[indx] = false;
        else
        {
            cs->mqtthost[indx] = strdup(cmd->args[0].val.sval);
            cs->mqttenabled[indx] = true;
            command_free(rcmd);
        }
    }
}


// Check whether we are still pending fog/cloud information..
// If not, we need to reset the cf_pending flag
//
void core_check_pending(corestate_t *cs)
{
    if (cs->mqttenabled[1] && cs->mqttenabled[2])
        cs->cf_pending = false;
}


void core_setup(corestate_t *cs, int timeout)
{
    cs->timeout = timeout;

    cs->device_id = get_device_id("./cdev.conf/deviceId");
}


void core_disconnect(corestate_t *cs)
{
    int i;

    for(i = 0; i < 3; i++)
        if (cs->mqttenabled[i] == true)
            MQTTClient_disconnect(cs->mqttserv[i], 500);
    usleep(500 * 1000);
}


void core_reconnect_i(corestate_t *cs, int i)
{
    if (cs->mqttenabled[i] == true)
    {
        cs->mqttserv[i] = mqtt_reconnect(cs->mqttserv[i]);
        if (cs->mqttserv[i] == NULL)
        {
            cs->mqttserv[i] = mqtt_open(cs->mqtthost[i]);
            if (cs->mqttserv[i] == NULL)
            {
                printf("\nWARNING! Unable to reconnect to the MQTT server at [%s].\n", cs->mqtthost[i]);
                printf("** Check whether an MQTT server is running at [%s] **\n\n", cs->mqtthost[i]);
                printf("Device could have moved away from the fog connection zone.\n");
            }
        }
    }
}


void core_reconnect(corestate_t *cs)
{
    int i;

    for(i = 0; i < 3; i++)
        core_reconnect_i(cs, i);
}
