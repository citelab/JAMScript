#include <czmq.h>
#include <stdio.h>

#include "jobject.h"
#include "jmsg.h"


/*
 * Start the actor and configure the service at the given port number
 */
zactor_t *configure_udp_beacons(int port)
{
    zactor_t *ubeacon = zactor_new(zbeacon, NULL);

    zstr_sendx(ubeacon, "si", "CONFIGURE", port);

    char *host = zstr_recv(ubeacon);
    assert(host);
    free(host);

    // setup a default subscription that allows everything..
    zsock_send(ubeacon, "sb", "SUBSCRIBE", "", 0);

    return ubeacon;
}


/*
 * Setup all the actors: zbeacon, jpobj_manager, jgossip, what else?
 * Continuously poll them and do the appropriate processing..
 */

int main(int argc, char *argv[])
{
    void *which;

    // We are hard coding the UDP beacon port number for now..
    zactor_t *ubeacon = configure_udp_beacons(9999);
    zactor_t *omanager = zactor_new(jobjmanager_main, NULL);

    // Setup the poller
    zpoller_t *poller = zpoller_new(ubeacon, omanager, NULL);
    assert(poller);

    // until interrupted.. do the infinite loop..
    while(!zsys_interrupted) {

        if ((which = zpoller_wait(poller, -1)) != NULL) {

            if (which == ubeacon) {
                // Receive the ip address and data frame.
                char *ipaddr = zstr_recv(ubeacon);
                if (ipaddr) {
                    zframe_t *bdata = zframe_recv(ubeacon);
                    unsigned char type = zframe_data(bdata)[0];
                    // Send the message to the jobjects manager
                    switch (type) {
                        case HELLO_TYPE:
                            zsock_send(omanager, "sb", "HELLO", bdata, zframe_size(bdata));
                            break;
                        case LAN_MSG_TYPE:
                            zsock_send(omanager, "sb", "LAN_MSG", bdata, zframe_size(bdata));
                            break;
                        default:
                            printf("WARNING! Unknown message type..\n");
                    }
                }
            }
            else
            if (which == omanager) {
                // Receive the message from the jobjects manager
                zframe_t *type = zframe_recv(omanager);
                unsigned char mtype = zframe_data(type)[0];
                if (mtype) {
                    zframe_t *odata = zframe_recv(omanager);
                    switch (mtype) {
                        case LAN_MSG_TYPE:
                            // if the message is for LAN.. broadcast it on the LAN
                            zsock_send(ubeacon, "sb", odata, zframe_size(odata));
                            break;
                        default:
                            // if the message is for the WAN.. gossip it on the WAN
                            // Not yet implemented..
                            printf("WARNING! Unknown message type...\n");
                    }
                }
            }
        }
    }
}



/*
 * We need to periodically trigger the following messages: SAYHELLO, DOGOSSIP. We could
 * load the next trigger into the event loop.
 *
 * Send the trigger message to the appropriate actor and it would emit the LAN broadcast
 * or WAN gossip. We receive messages from the other side due to remote triggers. The
 * messages we send are one way. That means they don't create responses from the other
 * nodes.
 *
 */
