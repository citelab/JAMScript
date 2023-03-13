idf_component_register(SRCS "udp.c" "processor.c" "entry.c" "calls.c" "cnode.c" "task.c" "command.c" "nvoid.c" "util.c" "system_manager.c" "multicast.c" "receiver.c"
                    INCLUDE_DIRS "." "../include"
                    REQUIRES freertos jam_component_wrap nvs_flash esp_event lwip esp_netif esp_wifi esp_timer)
