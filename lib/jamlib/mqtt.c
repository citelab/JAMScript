
#include <unistd.h>
#include <MQTTAsync.h>
#include <string.h>

#include "mqtt.h"
#include "command.h"

MQTTAsync mqtt_create(char *mhost)
{
    MQTTAsync mcl;

    char clientid[64];
    sprintf(clientid, "CLIENTID-%d-%s", getpid(), mhost);

    if (MQTTAsync_create(&mcl, mhost, clientid, MQTTCLIENT_PERSISTENCE_NONE, NULL) == MQTTASYNC_SUCCESS)
        return mcl;
    else
        return NULL;
}


int mqtt_connect(MQTTAsync mcl)
{

    MQTTAsync_connectOptions conn_opts = MQTTAsync_connectOptions_initializer;
    conn_opts.keepAliveInterval = 20;
    conn_opts.cleansession = 1;

    return MQTTAsync_connect(mcl, &conn_opts);
}


// Subscribe using QoS level 1
//
void mqtt_subscribe(MQTTAsync mcl, char *topic)
{
    if (topic != NULL)
        MQTTAsync_subscribe(mcl, topic, 1, NULL);
}

void mqtt_onpublish(void* context, MQTTAsync_successData* response)
{
    command_t *cmd = (command_t *)context;
    command_free(cmd);
}


// Publish without retain..QoS level 1
//
void mqtt_publish(MQTTAsync mcl, char *topic, command_t *cmd)
{
    MQTTAsync_responseOptions opts = MQTTAsync_responseOptions_initializer;
    opts.onSuccess = mqtt_onpublish;
    opts.context = cmd;

    if (MQTTAsync_send(mcl, topic, cmd->length, cmd->buffer, 1, 0, &opts) != MQTTASYNC_SUCCESS)
        printf("WARNING!! Unable to publish message to MQTT broker - topic: %s, buffer %s", topic, cmd->buffer);
}
