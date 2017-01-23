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

// The core_init() is the bootstrapping function for JAMlib. It runs the MQTT client
// (Paho) library in single thread mode - synchronous send and receive. Later we switch
// it to multi-threaded mode. 
//


corestate_t *core_init(int port, int timeout)
{
    command_t *scmd, *rcmd, *rcmd2;
    char serverhost[64];
    int count;
    #ifdef DEBUG_LVL1
        printf("Core initialization...");
    #endif

    // create the core state structure..
    corestate_t *cs = (corestate_t *)calloc(1, sizeof(corestate_t));
    core_setup(cs, timeout);
    sprintf(serverhost, "tcp://localhost:%d", port);
    // open an mqtt connection to localhost
    cs->mqttserv[0] = mqtt_open(serverhost);
    if (cs->mqttserv[0] == NULL)
    {
        printf("\nERROR! Unable to connect to the MQTT server at [%d].\n", port);
        printf("** Check whether an MQTT server is running at [%d] **\n\n", port);
        exit(1);
    }

    // send register message
    scmd = command_new("REGISTER", "DEVICE", "-", "-", cs->device_id, "");
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
        scmd = command_new("REGISTER", "DEVICE", "-", "-", cs->device_id, "");
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

    cs->mqttenabled[0] = true;

    // get information about the machine state: fog address, cloud address
    scmd = command_new("GET-CF-INFO", "DEVICE", "-", "-", cs->device_id, "");

    // No need to retry many times.. the server is already there..
    count = 0;
    do {
        mqtt_publish(cs->mqttserv[0], "/admin/request/all", scmd);
        rcmd = mqtt_receive(cs->mqttserv[0], "PUT-CF-INFO", "/admin/announce/all", cs->timeout);
    } while ((rcmd == NULL) && (count++ < 5));
    command_free(scmd);

    if (rcmd == NULL) 
    {
        // Unable to get fog/cloud status from the broker..
        printf("\nERROR! Unable to get cloud/fog status information.. \n");
        exit(1);
    } else
    {
        // process the information that we just received..
        for (int i = 0; i < rcmd->nargs; i++) 
        {
            cs->mqttserv[i+1] = mqtt_open(rcmd->args[i].val.sval);
            if (cs->mqttserv[i+1] != NULL) 
            {
                scmd = command_new("REGISTER", "DEVICE", "-", "-", cs->device_id, "");
                mqtt_publish(cs->mqttserv[i+1], "/admin/request/all", scmd); 
                command_free(scmd);
    
                // get the register acknowledge message 
                if ((rcmd2 = mqtt_receive(cs->mqttserv[i+1], "REGISTER-ACK", "/admin/announce/all", cs->timeout)) == NULL)
                    cs->mqttenabled[i+1] = false;
                else
                {
                    cs->mqttenabled[i+1] = true;
                    command_free(rcmd2);
                }
            }
        }
    }

    // We need to turn on the Asynchronous mode in the MQTT client...
    // This could be done later.. when we know the callbacks
    return cs;
}


void core_setup(corestate_t *cs, int timeout)
{
    cs->timeout = timeout;

    char buf[UUID4_LEN];
    uuid4_generate(buf);
    cs->device_id = strdup(buf);
}

// Core callback handlers for MQTT in Async mode 
void core_connlost(void *ctx, char *cause)
{

}

int core_msgarr(void *ctx, char *topicname, int tlen, MQTTClient_message *msg)
{
    return 0;
}

void core_delcomp(void *ctx, MQTTClient_deliveryToken dt)
{
    
}


// We are trying to do re-initialization because the connection is lost 
// We could have inferred this through a callback trigger
//
// TODO: We need have a core reinitialization routine. The challenge
// here is to handle the reply in the asynchronous mode. We need to create a
// local context and let the handlers update that context. We need to have asynchronous 
// receive routines that would actually receive from the local context. Check the local
// context for the completion of the reception. Get the message from there. Use a sleep 
// in the receiver to check. 
// 
void core_reinit(corestate_t *cs)
{
    int i;
    command_t *scmd;

    corecontext_t *ctx = (corecontext_t *)calloc(1, sizeof(corecontext_t));

    // Reset the callback handlers
    for (i = 0; i < 3; i++)
        MQTTClient_setCallbacks(cs->mqttserv[i], ctx, core_connlost, core_msgarr, core_delcomp);

    // TODO: This is totally incomplete.
}


void core_disconnect(corestate_t *cs)
{
    int i;

    for(i = 0; i < 3; i++)
        if (cs->mqttenabled[i] == true)
            MQTTClient_disconnect(cs->mqttserv[i], 500);
    usleep(500 * 1000);
}

void core_reconnect(corestate_t *cs)
{
    int i;

    for(i = 0; i < 3; i++)
        if (cs->mqttenabled[i] == true)
            cs->mqttserv[i] = mqtt_reopen(cs->mqttserv[i]);
}