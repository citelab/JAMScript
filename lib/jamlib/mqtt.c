
#include <unistd.h>
#include <MQTTAsync.h>
#include <string.h>

#include "mqtt.h"
#include "command.h"

extern char app_id[64];

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


// Subscribe using QoS level 1
//
void mqtt_subscribe(MQTTAsync mcl, char *topic)
{
    char fulltopic[128];
    sprintf(fulltopic, "/%s%s", app_id, topic);

    if (topic != NULL)
        MQTTAsync_subscribe(mcl, fulltopic, 1, NULL);
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
    char fulltopic[128];
    sprintf(fulltopic, "/%s%s", app_id, topic);

    MQTTAsync_responseOptions opts = MQTTAsync_responseOptions_initializer;
    opts.onSuccess = mqtt_onpublish;
    opts.context = cmd;

    if (MQTTAsync_send(mcl, fulltopic, cmd->length, cmd->buffer, 1, 0, &opts) != MQTTASYNC_SUCCESS)
        printf("WARNING!! Unable to publish message to MQTT broker - topic: %s, cmdr %s\n", topic, cmd->cmd);
}
