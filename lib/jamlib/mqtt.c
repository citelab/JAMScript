
#include <MQTTClient.h>
#include "mqtt.h"
#include "command.h"


MQTTClient mqtt_open(char *mhost) 
{
    MQTTClient mcl;
    MQTTClient_connectOptions conn_opts = MQTTClient_connectOptions_initializer;

    char clientid[64];
    sprintf(clientid, "CLIENTID-%d", getpid());

    MQTTClient_create(&mcl, mhost, clientid, MQTTCLIENT_PERSISTENCE_NONE, NULL);
    conn_opts.keepAliveInterval = 20;
    conn_opts.cleansession = 1;

    int rc;

    // OK, MQTTClient is actually a typedef on void *
    if ((rc = MQTTClient_connect(mcl, &conn_opts)) != MQTTCLIENT_SUCCESS)
        return NULL;

    return mcl;
}


void mqtt_publish(MQTTClient mcl, char *topic, command_t *cmd)
{
    if (MQTTClient_publish(mcl, topic, cmd->length, cmd->buffer, 1, 0, NULL) != MQTTCLIENT_SUCCESS)
        printf("WARNING!! Unable to publish message to MQTT broker - topic: %s", topic);

}

command_t *mqtt_receive(MQTTClient mcl, char *cmdstr, char *topic, int timeout)
{
    char *topicname;
    int tlen;
    MOTTClient_message *msg;
    command_t *cmd;

    if (MQTTClient_receive(mcl, &topicname, &tlen, &msg, timeout) == MQTTCLIENT_SUCCESS)
    {
        // timeout occured..
        if (msg == NULL)
            return NULL;
        
        // if wrong topic, ignore the message 
        if (strcmp(topic, topicname) != 0)
            return NULL;

        nvoid_t *nv = nvoid_new(msg->payload, msg->payloadlen);
        command_t *cmd = command_from_data(NULL, nv);
        nvoid_free(nv);

        // if wrong command in the message, ignore the message as well
        if (strcmp(cmd->cmd, cmdstr) != 0)
        {
            command_free(cmd);
            return NULL;
        }

        return cmd;
    }

    return NULL;
}
