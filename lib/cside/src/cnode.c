#include <stdio.h>
#include "tboard.h"
#include "mqtt_adapter.h"
#include "cnode.h"
#include "utilities.h"

char *find_my_ip(){
    return "127.0.0.1"; // temporary
}

cnode_core_t *cnode_core_init(char *worker_ip, cnode_args_t *args){
    // wrapper for core_init()
    // I dont know what to do with IP right now
    cnode_core_t *core = (cnode_core_t *)malloc(sizeof(cnode_core_t));
    core->group = (cnode_core_group_t *)malloc(sizeof(cnode_core_group_t));

    core->group->host = calloc(strlen(worker_ip)+1, sizeof(char));
    strcpy(core->group->host, worker_ip);
    core->group->port = args->port;
    core->cs = core_init(args->port, args->serialnum, args->numexecutors);
    return core;
}
void cnode_core_destroy(cnode_core_t *core) {
    // destroy wrapper for core
    if (core == NULL) {
        return;
    }
    if (core->group != NULL) {
        if (core->group->host != NULL)
            free(core->group->host);
        //if (core->group->null != NULL)
        //    free(core->group->null);
        free(core->group);
    }
    if (core->cs != NULL) {
        core_destroy((core->cs));
    }
    free(core);
}

cnode_t *cnode_init(int argc, char **argv){
    cnode_t *cn = (cnode_t *)calloc(1, sizeof(cnode_t));
    
    // get arguments
    cn->args = process_args(argc, argv);
    if (cn->args == NULL) {
        cnode_destroy(cn);
        terminate_error(true, "invalid command line");
    }

    // generate core
    cn->core = cnode_core_init(find_my_ip(), cn->args);
    if( cn->core == NULL ){
        cnode_destroy(cn);
        terminate_error(true, "cannot create the core");
    } else {
        cn->tboard = cn->core->cs->tboard; // this is created in core_init()
    }

    // find MQTT info
    cn->devjinfo = find_dev_j(cn->core->group);
    if( cn->devjinfo == NULL ){
        cnode_destroy(cn);
        terminate_error(true, "cannot find controller");
    }
    
    // create MQTT server adapter
    cn->devjserv = (server_t *)calloc(1, sizeof(server_t));
    if ( create_mqtt_adapter(DEVICE_LEVEL, cn->devjserv) == NULL ){
        cnode_destroy(cn);
        terminate_error(true, "cannot create MQTT adapter to controller");
    } else {
        mqtt_set_all_cbacks(cn->devjserv->mqtt, mqtt_connect_callback, mqtt_disconnect_callback,
            mqtt_message_callback, mqtt_subscribe_callback, 
            mqtt_publish_callback, mqtt_log_callback);
    }
    // connect to MQTT server adapter
    if( !connect_mqtt_adapter(cn->devjserv->mqtt, cn->devjinfo) ) {
        cnode_destroy(cn);
        terminate_error(true, "cannot connect to MQTT controller");
    }

    /** done in core_init() it would appear
    cn->tboard = tboard_create(0);
    */


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

    // free core
    if (cn->core != NULL) {
        cnode_core_destroy(cn->core);
    }

    // free MQTT server info
    if (cn->devjinfo != NULL) {
        destroy_dev_j(cn->devjinfo);
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
    /** done in core_destroy() it would appear
    if (cn->tboard != NULL) {
        tboard_destroy(cn->tboard);
    }
    */
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


MQTT_info_t *find_dev_j(cnode_core_group_t *group) {
    // this should perform a UDP scan or something, but for now I will hardcode the port as 1883
    MQTT_info_t *ret = (MQTT_info_t *)calloc(1, sizeof(MQTT_info_t));
    strcpy(ret->host, group->host);
    ret->port = group->port;
    ret->keep_alive = group->keep_alive;
    return ret;
}
void destroy_dev_j(MQTT_info_t *info){
    free(info);
}

/*
void subscribe_mqtt(MQTT_t *mqtt, cnode_t *cn) {
    // Nothing happens here that I am aware of
}
*/

