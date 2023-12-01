#include <stdio.h>
#include "tboard.h"
#include "mqtt-adapter.h"
#include "cnode.h"
#include "utilities.h"
#include "constants.h"
#include "command.h"
#include "multicast.h"
#include "calls.h"
#include "jcond.h"
#include <unistd.h>

cnode_t *cn;
int jamclock = 1;

int get_jamclock(cnode_t *cn)
{
    return jamclock++;
}

int get_serial(cnode_t *cn) {
    return cn->core->serial_num;
}

char *get_id(cnode_t *cn) {
    return cn->core->device_id;
}

// Memory leak here
topics_t *cnode_create_topics(char *app)
{
    char sbuf[1024];
    topics_t *t = (topics_t *)calloc(1, sizeof(topics_t));
    int tcnt = 0;
    snprintf(sbuf, 1024, "/%s/replies/down/c", app);
    t->subtopics[tcnt++] = strdup(sbuf);
    snprintf(sbuf, 1024, "/%s/announce/down", app);
    t->subtopics[tcnt++] = strdup(sbuf);
    snprintf(sbuf, 1024, "/%s/requests/down/c", app);
    t->subtopics[tcnt++] = strdup(sbuf);
    t->length = tcnt;

    snprintf(sbuf, 1024, "/%s/requests/up", app);
    t->requesttopic = strdup(sbuf);
    snprintf(sbuf,1024, "/%s/requests/down/c", app);
    t->selfrequesttopic = strdup(sbuf);
    snprintf(sbuf, 1024, "/%s/replies/up", app);
    t->replytopic = strdup(sbuf);

    return t;
}

void cnode_topics_destroy(topics_t *t)
{
    for (int i = 0; i < t->length; i++)
        free(t->subtopics[i]);
    free(t->requesttopic);
    free(t->selfrequesttopic);
    free(t->replytopic);
    free(t);
}


server_t *cnode_create_mbroker(cnode_t *cn, enum levels level, char *server_id, char *host, int port, char *topics[], int ntopics)
{
    server_t *serv = (server_t *)calloc(1, sizeof(server_t));
    serv->level = level;
    if (server_id != NULL)
        serv->server_id = strdup(server_id);
    else
        serv->server_id = NULL;
    serv->state = SERVER_NOT_REGISTERED;
    serv->mqtt = setup_mqtt_adapter(serv, level, host, port, topics, ntopics);
    serv->cnode = cn;
    return serv;
}

void cnode_recreate_mbroker(server_t *serv, enum levels level, char *server_id, char *host, int port, char *topics[], int ntopics)
{
    serv->level = level;
    if (server_id != NULL)
        serv->server_id = strdup(server_id);
    else
        serv->server_id = NULL;
    serv->state = SERVER_NOT_REGISTERED;
    serv->mqtt = setup_mqtt_adapter(serv, level, host, port, topics, ntopics);
}

broker_info_t *cnode_scanj(int groupid, char *host, int port) {
    char mgroup[32];
    int count = 5;
    broker_info_t *bi = NULL;

    if (groupid == 0) {
        bi = (broker_info_t *)calloc(1, sizeof(broker_info_t));
        strcpy(bi->host, host);
        bi->port = port;
        return bi;
    }

    snprintf(mgroup, 32, "%s.%d", Multicast_PREFIX, groupid);

    mcast_t *m = multicast_init(mgroup, Multicast_SENDPORT, Multicast_RECVPORT);
    // TODO: Fix this line.. and make it compatible with the protocol on Notion
    command_t *smsg = command_new(CmdNames_WHERE_IS_CTRL, 0, "", 0, "", "", "si", "127.0.0.1", port);
    multicast_setup_recv(m);
    multicast_send(m, smsg->buffer, smsg->length);
    while (count > 0 && (multicast_check_receive(m) == 0)) {
        multicast_send(m, smsg->buffer, smsg->length);
        count--;
        usleep(100000);
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
    multicast_destroy(m);
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
    cn->devinfo = cnode_scanj(cn->args->groupid, cn->args->host, cn->args->port);
    if (cn->devinfo == NULL ) {
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

    // Connect to the J server (MQTT), we don't have a server_id for the device, which is fine.
    cn->devserv = cnode_create_mbroker(cn, DEVICE_LEVEL, cn->core->device_id, cn->devinfo->host, cn->devinfo->port, cn->topics->subtopics, cn->topics->length);
    if ( cn->devserv == NULL) {
        cnode_destroy(cn);
        terminate_error(true, "cannot create MQTT broker");
    }
    cn->eservnum = 0;
    cn->cloudserv = NULL;
    cn->cnstate = CNODE_NOT_REGISTERED;
    // Do the initial registeration - it could fail and we resend on the next PING
    send_reg_msg(cn->devserv, cn->core->device_id, 0);

    tboard_start(cn->tboard);

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
    if (cn->devinfo != NULL) {
        free(cn->devinfo);
    }

    // free MQTT server
    if (cn->devserv != NULL) {
        if (cn->devserv->mqtt != NULL){
            disconnect_mqtt_adapter(cn->devserv->mqtt);
            //destroy_mqtt_adapter(cn->devserv->mqtt);
        }
        //free(cn->devserv);
    }

    free(cn);
}

bool cnode_start(cnode_t *cn) {
    // start_mqtt(cn->devserv);
    tboard_start(cn->tboard);
    return true;
}

bool cnode_stop(cnode_t *cn) {
    // tboard_shutdown is going to block.. until another thread kills the tboard.
    tboard_shutdown(cn->tboard);
    history_print_records(cn->tboard, stdout);
    return true;
}

void cnode_setcoords(cnode_t *cn, float xc, float yc)
{
    cn->xcoord = xc;
    cn->ycoord = yc;
}

void cnode_setwidth(cnode_t *cn, int width)
{
    cn->width = width;
}
