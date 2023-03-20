#include "multicast.h"

#include <esp_wifi.h>
#include <lwip/err.h>
#include <lwip/sys.h>

#include <stdlib.h>
#include <esp_timer.h>
#include <constants.h>
#include <udp.h>
#define DESTINATION_ADDR_IP (ipv4_address_t) {.a1 = 10, .a2 = 0, .a3 = 0, .a4 = 10}

#define DESTINATION_ADDR_IP_STR "10.0.0.10"

uint32_t factor_two_round_up(uint32_t num)
{
    return num + (num%2);
}

jam_error_t multicast_init(multicast_t* multicast, ipv4_address_t destination, port_t retport, port_t outgoing, uint32_t buffer_size)
{
    int status = JAM_OK;

    *multicast = (multicast_t) {0};
    multicast->packet_buffer_size = factor_two_round_up(buffer_size);
    ERR_PROP(udp_packet_init_headers(&multicast->packet_template, destination, retport, outgoing));

    return status;
}

multicast_t* multicast_create(ipv4_address_t destination, port_t retport, port_t outgoing, uint32_t buffer_size)
{
    uint32_t multicast_size = sizeof(multicast_t) + factor_two_round_up(buffer_size);
    multicast_t* multicast = (multicast_t*) aligned_alloc(4, multicast_size); 
    
    //printf("eTrouble pointer: %d +     %d\n", (int)(void*)multicast, offsetof(multicast_t, packet_template));

    printf("Creating multicast for %d : %d \n", (int)retport, (int)outgoing);
    if(multicast_init(multicast, destination, retport, outgoing, buffer_size)!=JAM_OK)
    {
        // @ERROR TODO: improve error message
        printf("Wasnt able to create multicast for %d : %d \n", (int)retport, (int)outgoing);
        free(multicast);
        return NULL;
    }

    return multicast;
}

void multicast_make_threadsafe(multicast_t* multicast)
{
    multicast->buffer_access = xSemaphoreCreateMutex();
    multicast->thread_safe = true;
}

// returns udp data buffer
uint8_t* _multicast_get_internal_buffer(multicast_t* multicast)
{
    return ((uint8_t*)multicast) + sizeof(multicast_t);
}

jam_error_t multicast_copy_send(multicast_t* multicast, void* buf, uint32_t buf_size)
{
    assert(buf_size <= multicast->packet_buffer_size);

    if(multicast->thread_safe)
        assert(xSemaphoreTake(multicast->buffer_access, 200) == pdTRUE);

    //dump_bufer_hex(buf, buf_size);

    memcpy(_multicast_get_internal_buffer(multicast), buf, buf_size);

    multicast_send(multicast, buf_size);

    if(multicast->thread_safe)
        xSemaphoreGive(multicast->buffer_access);


    return JAM_OK;
}

// The destination needs to register into an IGMP group, responses will be unicast.
// 
jam_error_t multicast_send(multicast_t* multicast, uint32_t buf_size)
{
    //uint32_t buf_size = factor_two_round_up(raw_buf_size);
    multicast->occupied_packet_buffer_size = buf_size;
    
    udp_packet_package(&multicast->packet_template, buf_size);

    int status;
    do
    {
        status = esp_wifi_80211_tx(WIFI_IF_STA, &multicast->packet_template, udp_packet_size(buf_size), 1);
        if(status == ESP_ERR_NO_MEM)
        {
            //printf("Ran out of wifi memory.\n");
            //printf("M\n");
            vTaskDelay(5);
        }
    } while (status == ESP_ERR_NO_MEM);
    
    return JAM_OK;
}

void* multicast_get_packet_buffer(multicast_t* multicast, uint32_t* buffer_size)
{   
    if(buffer_size!=NULL)
        *buffer_size = multicast->packet_buffer_size;
    return _multicast_get_internal_buffer(multicast);
}

//Test function

// TODO: remove multicast tests
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

    char buf[64]; // this is temp
    strcpy(buf, "Alternative message");

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

void multicast_test2()
{
    char* secret_message = "This is the super important secret message!";

    uint32_t packet_size;
    udp_packet_t* packet = calloc(1, udp_packet_size(strlen(secret_message)));

    // NOTE: passing back packet size is a bit dumb now.
    udp_packet_init(packet, 
                    DESTINATION_ADDR_IP, 
                    Multicast_RECVPORT, 
                    Multicast_SENDPORT, 
                    secret_message, 
                    strlen(secret_message), 
                    &packet_size);

    esp_wifi_80211_tx(WIFI_IF_STA, packet, packet_size, 1);
    esp_wifi_80211_tx(WIFI_IF_STA, packet, packet_size, 1);
    esp_wifi_80211_tx(WIFI_IF_STA, packet, packet_size, 1);
    esp_wifi_80211_tx(WIFI_IF_STA, packet, packet_size, 1);
}

void multicast_test()
{

    uint8_t primary;
    wifi_second_chan_t second;

    esp_wifi_get_channel(&primary, &second);

    printf("Channel info: Primary Channel %d, Secondary channel state: %d\n", (int) primary, (int) second);
    printf("Why is nothing getting printed?? \n\n\n\n");
    moss_udp_ping(DESTINATION_ADDR_IP_STR, 16000);
    moss_udp_ping(DESTINATION_ADDR_IP_STR, 16000);
    moss_udp_ping(DESTINATION_ADDR_IP_STR, 16000);
    moss_udp_ping(DESTINATION_ADDR_IP_STR, 16000);
    moss_udp_ping(DESTINATION_ADDR_IP_STR, 16000);
    moss_udp_ping(DESTINATION_ADDR_IP_STR, 16000);
    // Address line is first

    char* secret_message = "This is the super important secret message!";

    uint32_t packet_size;
    udp_packet_t* packet = malloc(udp_packet_size(strlen(secret_message)));

    // NOTE: passing back packet size is a bit dumb now.
    udp_packet_init(packet, 
                    DESTINATION_ADDR_IP, 
                    16500, 
                    16000, 
                    secret_message, 
                    strlen(secret_message), 
                    &packet_size);


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
        return;
    }


    for(int i = 0; i < 5; i++)
    {
        int status = esp_wifi_80211_tx(WIFI_IF_STA, packet, packet_size, 1);
        printf("This is the return status %d \n", status);
    }

}
