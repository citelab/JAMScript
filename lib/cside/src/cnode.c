#include <stdio.h>
#include "tboard.h"
#include "mqtt_adapter.h"
#include "cnode.h"
#include "utilities.h"
#include "constants.h"
#include "command.h"
#include "multicast.h"


topics_t *cnode_create_topics(char *app) 
{
    char sbuf[1024];
    topics_t *t = (topics_t *)calloc(1, sizeof(topics_t));
    int tcnt = 0;
    sprintf(sbuf, "/%s/replies/down", app);
    t->list[tcnt++] = strdup(sbuf);
    sprintf(sbuf, "/%s/announce/down", app);
    t->list[tcnt++] = strdup(sbuf);
    sprintf(sbuf, "/%s/requests/down", app);
    t->list[tcnt++] = strdup(sbuf);
    t->length = tcnt;

    return t;
}

void cnode_topics_destroy(topics_t *t) 
{
    for (int i = 0; i < t->length; i++) 
        free(t->list[i]);
    free(t);
}


server_t *cnode_create_mbroker(cnode_t *cn, enum levels level, char *host, int port, char *topics[], int ntopics)
{
    server_t *serv = (server_t *)calloc(1, sizeof(server_t));
    serv->level = level;
    serv->state = SERVER_NOT_REGISTERED;
    serv->mqtt = setup_mqtt_adapter(serv, level, host, port, topics, ntopics);
    serv->tboard = cn->tboard;
    return serv;
}


broker_info_t *cnode_scanj(int groupid) {
    char mgroup[32];
    int count = 100;
    broker_info_t *bi = NULL;

    sprintf(mgroup, "%s.%d", Multicast_PREFIX, groupid);
    mcast_t *m = multicast_init(mgroup, Multicast_SENDPORT, Multicast_RECVPORT);
    command_t *smsg = command_new(CmdNames_WHERE_IS_CTRL, 0, "", 0, "", "");
    multicast_send(m, smsg->buffer, smsg->length);
    while (count > 0 && (multicast_check_receive(m) == 0)) {
        multicast_send(m, smsg->buffer, smsg->length);
        count--;
    }
    if (count > 0) {
        unsigned char buf[1024];
        multicast_receive(m, buf, 1024);
        command_t *rmsg = command_from_data("si", buf, 1024);
        if (rmsg->cmd == CmdNames_HERE_IS_CTRL) {
            bi = (broker_info_t *)calloc(1, sizeof(broker_info_t));
            strcpy(bi->host, rmsg->args[0].val.sval);
            bi->port = rmsg->args[1].val.ival;
        }
        command_free(rmsg);
    }
    command_free(smsg);

    return bi;
}

cnode_t *cnode_init(int argc, char **argv){
    cnode_t *cn = (cnode_t *)calloc(1, sizeof(cnode_t));

    // get arguments
    cn->args = process_args(argc, argv);
    if (cn->args == NULL) {
        cnode_destroy(cn);
        terminate_error(true, "invalid command line");
    }

    cn->topics = cnode_create_topics(cn->args->appid);

    // generate core
    cn->core = core_init(cn->args->port, cn->args->snumber);
    if (cn->core == NULL) {
        cnode_destroy(cn);
        terminate_error(true, "cannot create the core");
    }

    // find the J node info by UDP scanning
    cn->devjinfo = cnode_scanj(cn->args->groupid);
    if (cn->devjinfo == NULL ) {
        cnode_destroy(cn);
        terminate_error(true, "cannot find the device j server");
    }

    // Start the taskboard 
    cn->tboard = tboard_create(cn, cn->args->nexecs);
    if ( cn->tboard == NULL ) {
        cnode_destroy(cn);
        terminate_error(true, "cannot create the task board");
    }

    mqtt_lib_init();

    // Connect to the J server (MQTT)
    cn->devjserv = cnode_create_mbroker(cn, DEVICE_LEVEL, cn->devjinfo->host, cn->devjinfo->port, cn->topics->list, cn->topics->length);
    if ( cn->devjserv == NULL) {
        cnode_destroy(cn);
        terminate_error(true, "cannot create MQTT broker");
    }

    return cn;
}

void cnode_destroy(cnode_t *cn) {
    // check if cnode is a pointer
    if ( cn == NULL ) {
        return;
    }

    // free arguments
    if (cn->args != NULL) {
        destroy_args(cn->args);
    }

    // free topics
    if (cn->topics != NULL) 
        cnode_topics_destroy(cn->topics);

    // free core
    if (cn->core != NULL) {
        core_destroy(cn->core);
    }

    // free MQTT server info
    if (cn->devjinfo != NULL) {
        free(cn->devjinfo);
    }

    // free MQTT server
    if (cn->devjserv != NULL) {
        if (cn->devjserv->mqtt != NULL){
            disconnect_mqtt_adapter(cn->devjserv->mqtt);
            //destroy_mqtt_adapter(cn->devjserv->mqtt);
        }
        //free(cn->devjserv);
    }

    // destroy tboard
    if (cn->tboard != NULL) {
        tboard_destroy(cn->tboard);
    }
    free(cn);
}

bool cnode_start(cnode_t *cn) {
    // start_mqtt(cn->devjserv);
    tboard_start(cn->tboard);
    return true;
}

bool cnode_stop(cnode_t *cn) {
    // tboard kill? nothing to stop anything is implemented
    tboard_kill(cn->tboard);
    return true;
}

