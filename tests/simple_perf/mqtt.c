
#include <unistd.h>
#include <MQTTClient.h>
#include <string.h>


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


void mqtt_publish(MQTTClient mcl, char *topic, char *msg)
{
    if (MQTTClient_publish(mcl, topic, strlen(msg), msg, 1, 0, NULL) != MQTTCLIENT_SUCCESS)
        printf("WARNING!! Unable to publish message to MQTT broker - topic: %s", topic);

}

