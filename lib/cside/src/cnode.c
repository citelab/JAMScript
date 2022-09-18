#include <stdio.h>
#include "tboard.h"
#include "mqtt_adapter.h"
#include "cnode.h"
#include "utilities.h"
#include "constants.h"
#include "command.h"
#include "multicast.h"
#include "calls.h"
#include <unistd.h>

cnode_t *cn;

topics_t *cnode_create_topics(char *app) 
{
    char sbuf[1024];
    topics_t *t = (topics_t *)calloc(1, sizeof(topics_t));
    int tcnt = 0;
    sprintf(sbuf, "/%s/replies/down", app);
    t->list[tcnt++] = strdup(sbuf);
    sprintf(sbuf, "/%s/announce/down", app);
    t->list[tcnt++] = strdup(sbuf);
    sprintf(sbuf, "/%s/requests/down/c", app);
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
    int count = 5;
    broker_info_t *bi = NULL;

    sprintf(mgroup, "%s.%d", Multicast_PREFIX, groupid);
    printf("Sending.. to %s\n", mgroup);
    mcast_t *m = multicast_init(mgroup, Multicast_SENDPORT, Multicast_RECVPORT);
    command_t *smsg = command_new(CmdNames_WHERE_IS_CTRL, 0, "", 0, "", "si", "127.0.0.1", 1883);
    multicast_setup_recv(m);
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
    cn->devjinfo = cnode_scanj(1);
    if (cn->devjinfo == NULL ) {
        cnode_destroy(cn);
        terminate_error(true, "cannot find the device j server");
    }
    printf("Done cnode scane %s, %d\n", cn->devjinfo->host, cn->devjinfo->port);
    // Start the taskboard 
    cn->tboard = tboard_create(cn, cn->args->nexecs);
    if ( cn->tboard == NULL ) {
        cnode_destroy(cn);
        terminate_error(true, "cannot create the task board");
    }

    mqtt_lib_init();

    printf("Connecting the MQTT..\n");
    // Connect to the J server (MQTT)
    cn->devjserv = cnode_create_mbroker(cn, DEVICE_LEVEL, cn->devjinfo->host, cn->devjinfo->port, cn->topics->list, cn->topics->length);
    if ( cn->devjserv == NULL) {
        cnode_destroy(cn);
        terminate_error(true, "cannot create MQTT broker");
    }

    printf("Starting the task board.. \n");
    tboard_start(cn->tboard);

    return cn;
}


void local_test(char *name, char *g, char *h)
{    
    arg_t *a;
    for (int i =0; i < 1000000; i++) {
     //   printf("This is local test.. %s\n", name);
    //    printf("This is local test.. %s\n", g);
     //   printf("This is local test.. %d %s\n", i, h);
    //    task_yield();
        a = remote_sync_call(cn->tboard, "testfunc", "", 0, "ssi", "this is test 1 - hello", "world", i);
        command_arg_free(a);
        task_yield();
 //       remote_sync_call(cs->tboard, "addfloat", "", 0, "ff", 45.0, 545.03434);
//        command_arg_print(a);
    }
}


void local_test3(char *name, char *g, char *h)
{    
    arg_t *a;
    for (int i =0; i < 1000000; i++) {
     //   printf("This is local test.. %s\n", name);
    //    printf("This is local test.. %s\n", g);
     //   printf("This is local test.. %d %s\n", i, h);
    //    task_yield();
        a = remote_sync_call(cn->tboard, "testfunc", "", 0, "ssi", "this is test 2 - hello", "world", i);
        command_arg_free(a);
        task_yield();
 //       remote_sync_call(cs->tboard, "addfloat", "", 0, "ff", 45.0, 545.03434);
//        command_arg_print(a);
    }
}


void local_test2(char *name, int k, double q)
{
    arg_t *q2;
    printf("This is local test.. %s\n", name);
    printf("This is local test.. %d\n", k);
    printf("This is local test.. %f\n", q);
    task_yield();

    for (int i = 0; i < 10; i++)
    {
        q2 = local_sync_call(cn->tboard, "callgive_value", "nagesh");
        printf("%d After . calling sync  %s\n", i, q2->val.sval);
        command_arg_free(q2);
        task_yield();
    }
}


void calllocal_test2(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    local_test2(t[0].val.sval, t[1].val.ival, t[2].val.dval);
    command_arg_free(t);
}

void *calllocal_test3(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    local_test3(t[0].val.sval, t[1].val.sval, t[2].val.sval);
    command_arg_free(t);
    return NULL;
}

void calllocal_test(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    local_test(t[0].val.sval, t[1].val.sval, t[2].val.sval);
    command_arg_free(t);
}

char *give_value(char *str)
{
    return str;
}

void callgive_value(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    arg_t retarg; // = calloc(1, sizeof(arg_t));
    retarg.type = STRING_TYPE;
    retarg.nargs = 1;

    retarg.val.sval = strdup(give_value(t->val.sval));

    mco_push(mco_running(), &retarg, sizeof(arg_t));
    command_arg_inner_free(t);
}


int main(int argc, char *argv[]) 
{
    cn = cnode_init(argc, argv);

 //   tboard_register_func(cn->tboard, TBOARD_FUNC(calllocal_test, "sss", false));
    printf("---------------------------------------\n");
    tboard_register_func(cn->tboard, TBOARD_FUNC(calllocal_test2, "sid", false));
    //tboard_register_func(cn->tboard, TBOARD_FUNC(callgive_value, "s", true));
    printf("=======================================\n");
    cnode_stop(cn);
    cnode_destroy(cn);
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

    free(cn);
}

bool cnode_start(cnode_t *cn) {
    // start_mqtt(cn->devjserv);
    tboard_start(cn->tboard);
    return true;
}

bool cnode_stop(cnode_t *cn) {
    // tboard_shutdown is going to block.. until another thread kills the tboard.
    tboard_shutdown(cn->tboard);
    return true;
}

