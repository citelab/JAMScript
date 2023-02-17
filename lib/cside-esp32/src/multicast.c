#include "multicast.h"

#include <esp_wifi.h>
#include <lwip/err.h>
#include <lwip/sys.h>
#include <stdlib.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "nvs_flash.h"

#include "lwip/err.h"
#include "lwip/sockets.h"
#include "lwip/sys.h"
#include "lwip/netdb.h"
#include "lwip/dns.h"
#include "sdkconfig.h"

#include "endian.h"

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

char* RAW = "\x00\x00\x30\x00\x2f\x40\x00\xa0\x20\x08\x00\xa0\x20\x08\x00\xa0" \
"\x20\x08\x00\x00\x00\x00\x00\x00\x56\x35\x42\x08\x00\x00\x00\x00" \
"\x10\x0c\x9e\x09\xc0\x00\xd6\x00\x00\x00\xd3\x00\xd0\x01\xd0\x02" \
"\x08\x62\x00\x00\xff\xff\xff\xff\xff\xff\xe0\xdb\xd1\xb7\x34\x81" \
"\xb8\x27\xeb\xcd\x85\xae\x00\x91\x2c\x3c\x00\x60\x00\x00\x00\x00" \
"\x80\x99\x06\xb2\x81\x41\x6e\x7c\x49\x84\x03\x98\xb6\xf2\x91\x38" \
"\x13\xfc\x19\x37\x9b\xd5\xae\xe4\x05\x36\x92\xd3\x0d\x9f\x86\xba" \
"\xca\xd2\x24\x30\x00\x90\xdd\xae\x0b\xc9\xdf\x0c\x9b\xa9\x7f\x69" \
"\x68\xed\x12\x38\xf9\x42\xec\xda\xf5\xa2\x49\x01\xdd\x1c\x74\x5f" \
"\xea\x22\xd2\xa0\x5a\x68\x9f\x5e\x39\x41\x0e\x30\x96\xc4\x28\x04" \
"\x29\xeb\x22\x98\xfc\x71\x09\x34\x34\x07\xa1\xeb\x8e\x64\xcc\xf8" \
"\xa7\xb2\x15\x9e\x10\x0b\x32\xe3\xd4\x5a\x7a\x1c\x65\x04\x89\x70" \
"\x4a\xf6\x06\x4a\xad\x1e\xaf\x89\xc3\xd1\x61\x13\xc4\x0c\xe5\x21" \
"\x07\xc9\x0c\xb4\xb9\x70\x3f\x8d\x0a\xe0\x2d\x35\x3c\xa8\xaa\x4b" \
"\x94\xa2\x1c\x3c\xa2\x62\x48\xe6\xe7\xa3\x9f\xa7\x5a\xa6\xac\xf2" \
"\x79\x54\xa2\x0c\xdc\xdb\x91\x98\x21\xe2\x4d\x08\xb2\x26\x5c\xaf" \
"\x1f\x77\x7c\xe3\x6b\x0d\x87\xc5\x30\x3f\x4f\xe5\x1f\x0f\xa6\x9b" \
"\x6e\x32\x23\x1c\xc7\x4a\xe6\xe8\x60\x15\x73\x5f\xec\x23\x1f\x46" \
"\x51\x67\xae\x96\xfc\x31\x64\x5f\xd9\x8f\x19\x0c\x33\x69\xef\xcf" \
"\x5f\x9c\xda\xc7\x56\x48\xbd\x31\xe6\x3d\x1b\x34\x67\x0b\x85\xb5" \
"\x66\x20\x2f\xc2\x36\x61\x5e\x23\x3a\xf8\x99\xfc\x50\xd4\x9e\xbe" \
"\xe2\x3d\x50\xaa\x3a\xd8\x4f\x99\x0a\xe8\x2c\x06\x28\x31\x1b\x87" \
"\x8e\xe5\x72\xb2\x59\x6e\x87\xda\x4c\x40\x19\x35\x7d\x1e\x66\x42" \
"\x2e\x07\x39\x66\x67\xeb\x51\x34\x3e\x68\xea\x27\x85\xe0\xac\xf0" \
"\xdd\xef\x14\xb9\x44\x6a\x23\x1f\x5b\xdb\x49\x13\x8b\x55\x25\xd0" \
"\xdf\x27\xfc\x2f\xc2\x3e\x19\x25\x38\xbe\x87\x69\xf4\x9f\x3b\x53" \
"\x11\x6f\x4c\xd0\x4b\xc4\x94\xe6\xd4\xff\x5c\xb3\xfa\xf7\x23\xf9" \
"\x74\xc4\x14\x35\x6a\x29\x38\x06\xe1\x4e\x64\xf1\xfe\x54\x23\xa5" \
"\xc1\xc4\x63\xe6\x05\x83\x07\x37\x2e\x6e\xd6\xaa\xd7\xd5\x4d\x74" \
"\x76\xa7\xb0\x76\xe2\xa8\x2f\x8c\xfe\xd1\x27\x8d\x5a\xb9\xa3\x22" \
"\x8e\x0e\x55\xd8\x7f\xdc\x68\xdc\x48\x14\xb5\xf0\x5d\x5b\xa8\xe8" \
"\xc2\x55\x1a\x08\x97\xf5\x74\x75\xc2\x53\xb6\x00\x14\x41";

// should change flags
#define DEVICE_MAC_ADDR "\x84\xcc\xa8\x53\x94\x50"
#define BSS_ID_TEMP     "\xe0\xdb\xd1\xb7\x34\x81"
//#define SOURCE_ADDR     "\x0a\x00\x00\x65"
#define SOURCE_ADDR     (ipv4_address_t) {.a1 = 0x0a, .a2 = 0x00, .a3 = 0x00, .a4 = 0x65}


// Temp
//#define DESTINATION_ADDR_IP "\x0a\x00\x00\x28"

//#define DESTINATION_ADDR_IP (ipv4_address_t) {.a1 = 0x0a, .a2 = 0x00, .a3 = 0x00, .a4 = 0x28}
#define DESTINATION_ADDR_IP (ipv4_address_t) {.a1 = 0x0a, .a2 = 0x00, .a3 = 0x00, .a4 = 0xab}

//#define DESTINATION_ADDR    "\xb8\x27\xeb\xcd\x85\xae"
//#define DESTINATION_ADDR    (mac_address_t) {0xb8, 0x27, 0xeb, 0xcd, 0x85, 0xae}
#define DESTINATION_ADDR    (mac_address_t) {0x98, 0xde, 0xd0, 0x10, 0xc2, 0xfd}

                //"\x98\xde\xd0\x10\xc2\xfd"
frame_80211_t frame_80211_udp_config(mac_address_t destination_addr)
{
    frame_80211_t frame_80211 = {0};
    frame_80211.frame_type0 = 0x08;
    frame_80211.frame_type1 = 0x01;

    memcpy(frame_80211.address3, destination_addr,  sizeof(mac_address_t));
    // TODO: automate the below terms
    memcpy(frame_80211.address2, DEVICE_MAC_ADDR,   sizeof(mac_address_t));
    memcpy(frame_80211.address1, BSS_ID_TEMP,       sizeof(mac_address_t));
    return frame_80211;
}

frame_80211_t frame_80211_rts_config()
{
    frame_80211_t frame_80211 = {0};
    frame_80211.frame_type0 = 0xb4;

    // This may get overwritten...
    frame_80211.duration = 400;

    //frame_80211.frame_type1 = 0x01;
    //memcpy(frame_80211.address3, destination_addr,  sizeof(mac_address_t));
    // TODO: automate the below terms
    memcpy(frame_80211.address1, DEVICE_MAC_ADDR,   sizeof(mac_address_t));
    memcpy(frame_80211.address2, BSS_ID_TEMP,       sizeof(mac_address_t));
    return frame_80211;
}

frame_llc_t frame_llc_udp_config()
{
    frame_llc_t frame_llc = {0};

    frame_llc.DSAP = 0xaa;
    frame_llc.SSAP = 0xaa;
    frame_llc.control_field = 0x03;
    frame_llc.type = bswap16(0x0800); // flipped from endianness

    return frame_llc;
}

inline void _accumulate(uint32_t* acc, uint16_t sumee)
{
    *acc += sumee;
    if(*acc > 0xffff)
        *acc -= 0xffff;
}


void frame_ip_calculate_checksum(frame_ip_t* frame)
{
    // header is 20 bytes
    frame->header_checksum = 0;

    // TODO: probably should unroll this
    uint16_t* cast_frame = (uint16_t*)frame;
    uint32_t acc = 0xffff;
    for(int i = 0; i < 10; i++)
    {
        _accumulate(&acc, bswap16(cast_frame[i]));
        printf("Checksum status %4x sum state: %4x checksum state: %4x\n", (uint16_t) bswap16(cast_frame[i]), (uint16_t) acc, (uint16_t)~(acc));
    }

    frame->header_checksum = ~bswap16((uint16_t)acc);
}

frame_ip_t frame_ip_udp_config(ipv4_address_t destination_addr)
{
    frame_ip_t frame_ip = {0};

    frame_ip.version = 0x45;

    // This is currently just header length.
    // Remaining packet + data size should be added to this number
    //frame_ip.total_length = 20; 

    frame_ip.identification = bswap16(0x0004); // flipped from endianness
    frame_ip.time_to_live = 0xff;
    frame_ip.protocol = 0x11; // UDP
    frame_ip.header_checksum = 0x00; // THIS IS JUST FOR NOW!

    frame_ip.destination_address = destination_addr;    
    frame_ip.source_address = SOURCE_ADDR;
    // These could just be assignments
    //memcpy(&frame_ip.source_address, SOURCE_ADDR, sizeof(ipv4_address_t));

    return frame_ip;
}

void frame_udp_calculate_checksum(frame_udp_t* udp_frame, frame_ip_t* ip_frame, uint32_t full_size)
{
    // header is 20 bytes
    udp_frame->checksum = 0;

    // TODO: probably should unroll this
    uint16_t* cast_frame = 0;
    uint32_t acc = 0xffff;

    // Pseudoheader
    cast_frame = (uint16_t*)&ip_frame->source_address;
    for(int i = 0; i < 4; i++)
    {
        _accumulate(&acc, bswap16(cast_frame[i]));  
    }
    _accumulate(&acc, bswap16(udp_frame->length));
    _accumulate(&acc, ip_frame->protocol);
    
    cast_frame = (uint16_t*)udp_frame;
    for(int i = 0; i < full_size/2; i++)
    {
        _accumulate(&acc, bswap16(cast_frame[i]));
        printf("Checksum status %4x sum state: %4x checksum state: %4x\n", (uint16_t) bswap16(cast_frame[i]), (uint16_t) acc, (uint16_t)~(acc));
    }

    udp_frame->checksum = ~bswap16((uint16_t)acc);
}

udp_packet_t* udp_packet_init(ipv4_address_t destination, 
                              uint16_t source_port, 
                              uint16_t destination_port, 
                              void* buffer, 
                              uint32_t buffer_size,
                              uint32_t* packet_size)
{
    uint32_t raw_size = sizeof(udp_packet_t)+buffer_size;
    uint32_t padded_size = raw_size + 2 - (raw_size % 2);

    udp_packet_t* packet = calloc(1, padded_size);
    packet->frame_80211 = frame_80211_udp_config(DESTINATION_ADDR); //TODO: Replace
    packet->frame_llc   = frame_llc_udp_config();
    packet->frame_ip    = frame_ip_udp_config(destination);
    
    packet->frame_udp = (frame_udp_t) { 0 };
    packet->frame_udp.source_port       = bswap16(source_port);
    packet->frame_udp.destination_port  = bswap16(destination_port);
    packet->frame_udp.length = bswap16(sizeof(frame_udp_t) + buffer_size);

    packet->frame_ip.total_length = bswap16(sizeof(frame_ip_t) + sizeof(frame_udp_t) + buffer_size);

    frame_ip_calculate_checksum(&packet->frame_ip);

    memcpy(((uint8_t*)packet) + sizeof(udp_packet_t), buffer, buffer_size);

    frame_udp_calculate_checksum(&packet->frame_udp, &packet->frame_ip, sizeof(frame_udp_t) +buffer_size + 1); // 1 is for rounding
    if(packet_size!=NULL)
    {
        *packet_size = padded_size; // not sure if padding is completely necessary.. conflicting information on it.
    }

    return packet;
}
void multicast_test()
{
    uint8_t primary;
    wifi_second_chan_t second;

    esp_wifi_get_channel(&primary, &second);

    printf("Channel info: Primary Channel %d, Secondary channel state: %d\n", (int) primary, (int) second);
    printf("Why is nothing getting printed?? \n\n\n\n");
    moss_udp_ping("10.0.0.127", 80);

    moss_udp_ping("10.0.0.40", 80);moss_udp_ping("10.0.0.40", 80);moss_udp_ping("10.0.0.40", 80);moss_udp_ping("10.0.0.40", 80);
    // Address line is first


    char* raw = ""\
            "\x98\xde\xd0\x10\xc2\xfd\x84\xcc\xa8\x53\x94\x50\x08\x00\x45\x00" \
            "\x00\x1d\x00\x04\x00\x00\xff\x11\xa6\xbc\x0a\x00\x00\x65\x0a\x00" \
            "\x00\xab\xe7\x59\x00\x50\x00\x09\xd3\x22\x30\x00\x00\x00\x00\x00" \
            "\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
            ;

    char * MASH =   "\x08\x00" \
                    "\x00\x00" \
                    "\xb8\x27\xeb\xcd\x85\xae" \
                    "\x84\xcc\xa8\x53\x94\x50" \
                    "\xe0\xdb\xd1\xb7\x34\x81" \
                    "\x00\x00" \
                    "\xaa\xaa\x03\x00\x00\x00\x08\x00" \
                    "\x45\x00" \
                    "\x00\x1d\x00\x04\x00\x00\xff\x11\xa6\xbc" \
                    "\x0a\x00\x00\x65" \
                    "\x0a\x00\x00\x28" \
                    "\xe7\x59\x00\x50\x00\x09\xd3\x22\x35\x00\x00\x00\x00\x00" \
                    "\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00";

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