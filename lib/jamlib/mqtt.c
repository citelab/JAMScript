
#include <unistd.h>
#include <MQTTAsync.h>
#include <string.h>

#include "mqtt.h"
#include "command.h"

extern char app_id[64];

MQTTAsync mqtt_create(char *mhost, int i, char *devid)
{
    MQTTAsync mcl;

    char clientid[64];
    sprintf(clientid, "%s-%d-%d", devid, i, getpid());

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
    if (MQTTAsync_isConnected(mcl) == false)
        printf("WARNING! The handle.. is offline..\n");

    char fulltopic[128];
    sprintf(fulltopic, "/%s%s", app_id, topic);

    MQTTAsync_responseOptions opts = MQTTAsync_responseOptions_initializer;
    opts.onSuccess = mqtt_onpublish;
    opts.context = cmd;

    int rc = MQTTAsync_send(mcl, fulltopic, cmd->length, cmd->buffer, 1, 0, &opts);
    if (rc != MQTTASYNC_SUCCESS)
        printf("WARNING!! Unable to publish message (error %d) to MQTT broker - topic: %s, cmdr %s\n", rc, topic, cmd->cmd);
}
