#include "multicast.h"

#include <esp_wifi.h>
#include <lwip/err.h>
#include <lwip/sys.h>
#include <stdlib.h>

#include <udp.h>

uint32_t factor_two_round_up(uint32_t num)
{
    return num + (num%2);
}

error_t multicast_init(multicast_t* multicast, ipv4_address_t destination, port_t outgoing, port_t incoming, uint32_t buffer_size)
{
    int status = JAM_OK;

    *multicast = (multicast_t) {0};
    multicast->packet_buffer_size = factor_two_round_up(buffer_size);
    ERR_PROP(udp_packet_init_headers(&multicast->packet_template, destination, outgoing, incoming));

    return status;
}

multicast_t* multicast_create(ipv4_address_t destination, port_t outgoing, port_t incoming, uint32_t buffer_size)
{
    uint32_t multicast_size = sizeof(multicast_t) + factor_two_round_up(buffer_size);
    multicast_t* multicast = (multicast_t*) calloc(0, multicast_size);

    if(multicast_init(multicast, outgoing, incoming, destination, buffer_size)!=JAM_OK)
    {
        // @ERROR TODO: improve error message
        printf("Wasnt able to create multicast for %d : %d \n", (int)outgoing, (int)incoming);
        free(multicast);
        return NULL;
    }

    return multicast;
}

// returns udp data buffer
void* _multicast_get_internal_buffer(multicast_t* multicast)
{
    return ((void*)multicast) + sizeof(multicast);
}

error_t multicast_copy_send(multicast_t* multicast, void* buf, uint32_t buf_size)
{
    assert(buf_size <= multicast->packet_buffer_size);
    memcpy(_multicast_get_internal_buffer(multicast), buf, buf_size);
    multicast->occupied_packet_buffer_size = buf_size;

    ERR_PROP(multicast_send(multicast));

    return JAM_OK;
}

// The destination needs to register into an IGMP group, responses will be unicast.
// 
error_t multicast_send(multicast_t* multicast)
{
    int size = multicast->occupied_packet_buffer_size;
    udp_packet_packge(multicast->packet_template, size);

    int status = esp_wifi_80211_tx(WIFI_IF_STA, &multicast->packet_template, udp_packet_size(size), 1);
    if(status == ESP_ERR_WIFI_NO_MEM)
        return JAM_MEMORY_ERR;
    return JAM_OK;
}

void* multicast_get_packet_buffer(multicast_t* multicast, uint32_t* buffer_size)
{   
    if(buffer_size!=NULL)
        *buffer_size = multicast->packet_buffer_size;
    return _multicast_get_internal_buffer(multicast);
}
//Test function
void moss_udp_ping(char* server, int port)
{
    int err;
    int s;

    struct sockaddr_in dest_addr;
    dest_addr.sin_addr.s_addr = inet_addr(server);
    dest_addr.sin_family = AF_INET;
    dest_addr.sin_port = htons(port);

    s = socket(AF_INET, SOCK_DGRAM, IPPROTO_IP);
    if(s < 0)
    {
        printf("... Failed to allocate socket.\n");
        return;
    }

    // TODO: Need to figure out what to send here.

    char buf[64]; // this is temp
    strcpy(buf, "Alternative message");

    // TODO: check what flags to use here
    //for(int i = 0; i < 1; i++)
    {
        err = sendto(s, buf, strlen(buf), 0, (struct sockaddr *)&dest_addr, sizeof(dest_addr));
        if(err == -1)
        {
            printf("... Failed to send datagram. errno=%d\n", errno);
            return;
        }
    }
    close(s);
    return;
}

void multicast_test()
{

    uint8_t primary;
    wifi_second_chan_t second;

    esp_wifi_get_channel(&primary, &second);

    printf("Channel info: Primary Channel %d, Secondary channel state: %d\n", (int) primary, (int) second);
    printf("Why is nothing getting printed?? \n\n\n\n");
    moss_udp_ping(DESTINATION_ADDR_IP_STR, 80);
    moss_udp_ping(DESTINATION_ADDR_IP_STR, 80);
    moss_udp_ping(DESTINATION_ADDR_IP_STR, 80);
    moss_udp_ping(DESTINATION_ADDR_IP_STR, 80);
    moss_udp_ping(DESTINATION_ADDR_IP_STR, 80);
    moss_udp_ping(DESTINATION_ADDR_IP_STR, 80);
    // Address line is first

    char* secret_message = "This is the super important secret message!";

    uint32_t packet_size;
    udp_packet_t* packet = udp_packet_init(DESTINATION_ADDR_IP, 
                                           2000, 
                                           80, 
                                           secret_message, 
                                           strlen(secret_message), 
                                           &packet_size);


    //frame_80211_t* rts = (frame_80211_t*) malloc(sizeof(frame_80211_t));
    //*rts = frame_80211_rts_config();

    //esp_wifi_80211_tx(WIFI_IF_STA, rts, sizeof(rts), true);


    int64_t start_time = 0, current_time = 0; // in microseconds
    start_time = esp_timer_get_time();
    int per_second_count = 0;

    start_time = esp_timer_get_time();
    while(1)
    {
        int status = esp_wifi_80211_tx(WIFI_IF_STA, packet, packet_size, 1);
        if (status==ESP_OK)
        {
            per_second_count++;
        }

        current_time = esp_timer_get_time();

        if(start_time + 1000000 < current_time)
        {
            vTaskDelay(10);
            printf("Was able to send %d packets per second! %lld\n", per_second_count, current_time);

            per_second_count = 0;
            start_time = esp_timer_get_time();
        }

    }


    for(int i = 0; i < 5; i++)
    {
        int status = esp_wifi_80211_tx(WIFI_IF_STA, packet, packet_size, 1);
        printf("This is the return status %d \n", status);
    }

}

//multicast_source* multicast_create(sockaddr_in addr)
//{
    
    //return NULL;
//}
